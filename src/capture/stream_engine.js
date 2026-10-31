const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const displayManager = require('./display_manager');
const InputSanitizer = require('../security/input_sanitizer');

const INJECTOR_EXE = path.join(__dirname, 'native', 'input_injector.exe');
const RUNNER_EXE = path.join(__dirname, 'native', 'desktop_runner.exe');

class StreamEngine {
    constructor(config = {}) {
        this.config = Object.assign({
            bitrate: '15M',
            maxrate: '18M',
            fps: 60,
            encoder: 'h264_nvenc', // RTX 5060 hardware encoder
            allowKeyboard: false
        }, config);

        this.sanitizer = new InputSanitizer({ allowKeyboard: this.config.allowKeyboard });
        this.activeStreams = new Map(); // displayId -> { ffmpeg, clients: Set<WebSocket>, mode: 'ddagrab' | 'gdigrab' }
        this.injectorProc = null;
        this.initInputInjector();
    }

    initInputInjector() {
        if (!fs.existsSync(INJECTOR_EXE)) {
            console.warn(`[StreamEngine] Input injector binary not found at ${INJECTOR_EXE}. Touch/mouse feedback disabled.`);
            return;
        }

        try {
            this.injectorProc = spawn(INJECTOR_EXE, [], {
                stdio: ['pipe', 'pipe', 'ignore'],
                windowsHide: true
            });

            this.injectorProc.on('error', (err) => {
                console.error('[StreamEngine] Input injector error:', err.message);
                this.injectorProc = null;
            });

            this.injectorProc.on('exit', () => {
                this.injectorProc = null;
            });

            console.log('[StreamEngine] Native Win32 input injector initialized.');
        } catch (err) {
            console.error('[StreamEngine] Failed to spawn input injector:', err.message);
        }
    }

    handleInputEvent(event, displayId) {
        if (!this.injectorProc || !this.injectorProc.stdin || this.injectorProc.stdin.destroyed) {
            return false;
        }

        const display = displayManager.getDisplay(displayId);
        if (!display) return false;

        // Security: Sanitize and hard-clamp coordinates strictly inside assigned display
        const safeCmd = this.sanitizer.sanitize(event, display);
        if (!safeCmd) return false;

        try {
            this.injectorProc.stdin.write(JSON.stringify(safeCmd) + '\n');
            return true;
        } catch (err) {
            console.error('[StreamEngine] Failed to write to input injector:', err.message);
            return false;
        }
    }

    subscribeClient(displayId, ws) {
        displayId = Number(displayId);
        let stream = this.activeStreams.get(displayId);

        if (!stream) {
            stream = {
                displayId,
                ffmpeg: null,
                clients: new Set(),
                mode: 'ddagrab' // Start with ultra-low latency DXGI
            };
            this.activeStreams.set(displayId, stream);
            this.startFfmpeg(stream);
        }

        stream.clients.add(ws);
        console.log(`[StreamEngine] Client subscribed to Display ${displayId}. Total viewers for this display: ${stream.clients.size}`);

        ws.on('close', () => {
            this.unsubscribeClient(displayId, ws);
        });
    }

    unsubscribeClient(displayId, ws) {
        displayId = Number(displayId);
        const stream = this.activeStreams.get(displayId);
        if (!stream) return;

        stream.clients.delete(ws);
        console.log(`[StreamEngine] Client disconnected from Display ${displayId}. Remaining viewers: ${stream.clients.size}`);

        // If no clients left watching this display, stop the hardware encoder to conserve GPU
        if (stream.clients.size === 0) {
            this.stopFfmpeg(stream);
            this.activeStreams.delete(displayId);
            console.log(`[StreamEngine] Display ${displayId} encoder stopped (idle).`);
        }
    }

    startFfmpeg(stream) {
        const display = displayManager.getDisplay(stream.displayId);
        if (!display) {
            console.error(`[StreamEngine] Display ${stream.displayId} not found.`);
            return;
        }

        const fps = this.config.fps || 60;
        const bitrate = this.config.bitrate || '15M';
        const maxrate = this.config.maxrate || '18M';

        let inputArgs = [];
        if (stream.mode === 'ddagrab') {
            // Ultra-low latency DXGI Desktop Duplication
            inputArgs = [
                '-filter_complex', `ddagrab=output_idx=${stream.displayId}:framerate=${fps}:draw_mouse=1`
            ];
        } else {
            // Fallback GDI capture
            inputArgs = [
                '-f', 'gdigrab',
                '-framerate', `${fps}`,
                '-offset_x', `${display.left}`,
                '-offset_y', `${display.top}`,
                '-video_size', `${display.width}x${display.height}`,
                '-i', 'desktop'
            ];
        }

        // RTX 5060 NVENC ultra-low latency flags
        const nvencArgs = [
            '-c:v', this.config.encoder,
            '-preset', 'p1',             // Fastest ultra-low-latency NVENC preset
            '-tune', 'ull',              // Ultra-low latency tuning
            '-zerolatency', '1',
            '-rc', 'cbr',                // Constant Bitrate
            '-b:v', bitrate,
            '-maxrate', maxrate,
            '-bufsize', '500k',          // Small buffer for immediate delivery
            '-g', `${Math.round(fps / 2)}`, // Intra-refresh GOP every 0.5 sec for instant sync
            '-bf', '0',                  // Zero B-frames to eliminate decoding delay
            '-profile:v', 'baseline',
            '-f', 'h264',
            'pipe:1'
        ];

        const ffmpegArgs = [
            '-hide_banner',
            '-loglevel', 'warning',
            ...inputArgs,
            ...nvencArgs
        ];

        const useRunner = fs.existsSync(RUNNER_EXE);
        const spawnCmd = useRunner ? RUNNER_EXE : 'ffmpeg';
        const spawnArgs = useRunner ? ['ffmpeg', ...ffmpegArgs] : ffmpegArgs;

        console.log(`[StreamEngine] Starting hardware encoder for Display ${stream.displayId} (${stream.mode}) via ${useRunner ? 'desktop_runner' : 'ffmpeg'}...`);

        try {
            const proc = spawn(spawnCmd, spawnArgs, {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            stream.ffmpeg = proc;
            let startedAt = Date.now();
            let hasLoggedFrame = false;

            proc.stdout.on('data', (chunk) => {
                if (!hasLoggedFrame) {
                    console.log(`[StreamEngine] GPU frames successfully generated and streaming to Display ${stream.displayId} viewers!`);
                    hasLoggedFrame = true;
                }
                // Broadcast video NAL units to all authenticated clients on this monitor
                for (const client of stream.clients) {
                    if (client.readyState === 1 /* OPEN */) {
                        try {
                            client.send(chunk);
                        } catch {
                            // Client write error
                        }
                    }
                }
            });

            proc.stderr.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) console.warn(`[StreamEngine:FFmpeg stderr] ${msg}`);
            });

            proc.on('exit', (code) => {
                console.log(`[StreamEngine] FFmpeg process exited with code ${code}.`);
                const lifetime = Date.now() - startedAt;

                // Automatic failover: If ddagrab failed right away, fall back to gdigrab
                if (stream.mode === 'ddagrab' && lifetime < 2000 && stream.clients.size > 0) {
                    console.warn('[StreamEngine] ddagrab failed or denied. Falling back to GDI mode...');
                    stream.mode = 'gdigrab';
                    this.startFfmpeg(stream);
                } else if (stream.clients.size > 0) {
                    // Reconnect after brief pause
                    setTimeout(() => {
                        if (stream.clients.size > 0) this.startFfmpeg(stream);
                    }, 1000);
                }
            });

        } catch (err) {
            console.error('[StreamEngine] Failed to spawn FFmpeg:', err.message);
        }
    }

    stopFfmpeg(stream) {
        if (stream.ffmpeg) {
            try {
                stream.ffmpeg.kill('SIGTERM');
            } catch {
                // Already exited
            }
            stream.ffmpeg = null;
        }
    }

    shutdown() {
        for (const stream of this.activeStreams.values()) {
            this.stopFfmpeg(stream);
        }
        this.activeStreams.clear();
        if (this.injectorProc) {
            try { this.injectorProc.kill(); } catch {}
        }
    }
}

module.exports = StreamEngine;
