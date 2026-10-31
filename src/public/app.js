/**
 * AegisDisplay Client Controller
 * WebCodecs Ultra-Low Latency Video Decoder & PWA Controller
 */

(() => {
    let ws = null;
    let sessionToken = null;
    let selectedDisplayId = null;
    let videoDecoder = null;
    let isDecoderConfigured = false;
    let nalBuffer = new Uint8Array(0);
    let spsUnit = null;
    let ppsUnit = null;
    let wakeLock = null;
    let deferredInstallPrompt = null;

    // UI Elements
    const authPanel = document.getElementById('auth-panel');
    const displayPanel = document.getElementById('display-panel');
    const viewportPanel = document.getElementById('viewport-panel');
    const pinForm = document.getElementById('pin-form');
    const pinInput = document.getElementById('pin-input');
    const authError = document.getElementById('auth-error');
    const displayList = document.getElementById('display-list');
    const btnRefresh = document.getElementById('btn-refresh-displays');
    const displayCanvas = document.getElementById('display-canvas');
    const ctx = displayCanvas.getContext('2d');
    const streamLoading = document.getElementById('stream-loading');
    const statsChip = document.getElementById('stats-chip');
    const statFps = document.getElementById('stat-fps');
    const statLatency = document.getElementById('stat-latency');
    const btnFullscreen = document.getElementById('btn-fullscreen-toggle');
    const floatingFsBtn = document.getElementById('floating-fs-btn');
    const btnDisconnect = document.getElementById('btn-disconnect');
    const btnInstallApp = document.getElementById('btn-install-app');

    let fpsCounter = 0;
    let lastFpsUpdate = Date.now();
    let touchHandler = null;

    // 1. Service Worker & PWA Install Support
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
                console.log('[SW] Service worker registration note:', err.message);
            });
        });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        if (btnInstallApp) {
            btnInstallApp.style.display = 'inline-block';
            btnInstallApp.addEventListener('click', async () => {
                if (deferredInstallPrompt) {
                    deferredInstallPrompt.prompt();
                    const { outcome } = await deferredInstallPrompt.userChoice;
                    console.log(`[PWA] Install prompt outcome: ${outcome}`);
                    deferredInstallPrompt = null;
                    btnInstallApp.style.display = 'none';
                }
            });
        }
    });

    // 2. Screen Wake Lock (Prevents laptop/phone screen from sleeping)
    async function acquireWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('[WakeLock] Screen wake lock acquired. Screen will not sleep.');
                wakeLock.addEventListener('release', () => {
                    wakeLock = null;
                });
            } catch (err) {
                console.warn('[WakeLock] Could not acquire wake lock:', err.message);
            }
        }
    }

    function releaseWakeLock() {
        if (wakeLock) {
            wakeLock.release().catch(() => {});
            wakeLock = null;
        }
    }

    // 3. Connect Secure WebSocket (WSS)
    function connectWebSocket() {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${proto}//${window.location.host}/ws`;

        ws = new WebSocket(url);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            console.log('[WebSocket] Secure connection established.');
        };

        ws.onmessage = (event) => {
            if (typeof event.data === 'string') {
                handleJsonMessage(JSON.parse(event.data));
            } else if (event.data instanceof ArrayBuffer) {
                handleBinaryVideoChunk(new Uint8Array(event.data));
            }
        };

        ws.onclose = () => {
            console.warn('[WebSocket] Connection closed.');
            releaseWakeLock();
            showAuthError('Disconnected from host server. Please refresh.');
        };

        ws.onerror = (err) => {
            console.error('[WebSocket] Error:', err);
        };
    }

    function sendJson(msg) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    }

    function showAuthError(msg) {
        authError.textContent = msg;
        authError.style.display = 'block';
    }

    function hideAuthError() {
        authError.style.display = 'none';
    }

    // Step 1: Authentication Form
    pinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pin = pinInput.value.trim();
        if (pin.length !== 6) {
            showAuthError('Please enter a valid 6-digit PIN.');
            return;
        }

        hideAuthError();
        sendJson({
            type: 'auth',
            pin: pin,
            userAgent: navigator.userAgent
        });
    });

    // Step 2: Message Handlers
    function handleJsonMessage(msg) {
        switch (msg.type) {
            case 'auth_success':
                sessionToken = msg.token;
                console.log('[Auth] Authenticated successfully with host.');
                authPanel.style.display = 'none';
                displayPanel.style.display = 'block';
                requestDisplays();
                break;

            case 'auth_failure':
                showAuthError(msg.error || 'Authentication failed.');
                break;

            case 'displays_list':
                renderDisplays(msg.displays);
                break;

            case 'pong':
                if (msg.sentTime) {
                    const rtt = Date.now() - msg.sentTime;
                    statLatency.textContent = `${rtt} ms`;
                }
                break;

            case 'error':
                alert(`Error: ${msg.message}`);
                break;
        }
    }

    function requestDisplays() {
        sendJson({
            type: 'get_displays',
            token: sessionToken
        });
    }

    btnRefresh.addEventListener('click', requestDisplays);

    function renderDisplays(displays) {
        displayList.innerHTML = '';
        if (!displays || displays.length === 0) {
            displayList.innerHTML = '<p style="color:#8b949e;">No active displays detected.</p>';
            return;
        }

        // Auto-detect Extended Monitor:
        // Automatically select the extended screen (isPrimary === false) without requiring manual clicks
        const targetDisplay = displays.find(d => !d.isPrimary) || displays[0];
        if (targetDisplay && selectedDisplayId === null) {
            console.log(`[AutoDetect] Auto-selecting display: ${targetDisplay.name} (${targetDisplay.width}x${targetDisplay.height}, Primary: ${targetDisplay.isPrimary})`);
            selectDisplay(targetDisplay.id, targetDisplay);
            return;
        }

        displays.forEach((d) => {
            const card = document.createElement('div');
            card.className = 'display-card';
            card.innerHTML = `
                <div class="display-info">
                    <div class="d-title">${d.name} ${d.isPrimary ? '<span class="badge">Primary</span>' : '<span class="badge" style="color:#58a6ff;background:rgba(88,166,255,0.15)">Extended</span>'}</div>
                    <div class="d-specs">${d.width} × ${d.height} @ [${d.left}, ${d.top}]</div>
                </div>
                <button class="btn-primary" style="width:auto;padding:8px 16px;">Connect</button>
            `;
            card.addEventListener('click', () => {
                selectDisplay(d.id, d);
            });
            displayList.appendChild(card);
        });
    }

    function selectDisplay(id, displayInfo) {
        selectedDisplayId = id;
        displayPanel.style.display = 'none';
        viewportPanel.style.display = 'flex';
        statsChip.style.display = 'flex';

        acquireWakeLock();
        initWebCodecsDecoder();

        // Initialize touch & mouse input handler
        touchHandler = new window.TouchInputHandler(displayCanvas, (inputEvent) => {
            sendJson({
                type: 'input',
                token: sessionToken,
                event: inputEvent
            });
        });
        touchHandler.enable();

        // Subscribe to display video stream
        sendJson({
            type: 'select_display',
            token: sessionToken,
            displayId: id
        });

        // Ping loop for latency tracking
        setInterval(() => {
            sendJson({
                type: 'ping',
                sentTime: Date.now()
            });
        }, 1500);
    }

    // Step 3: WebCodecs Hardware Video Decoding
    function initWebCodecsDecoder() {
        if (!('VideoDecoder' in window)) {
            alert('Your browser does not support WebCodecs. Please update to a modern browser (Chrome, Edge, Safari 16.4+, Opera).');
            return;
        }

        videoDecoder = new VideoDecoder({
            output: (videoFrame) => {
                if (displayCanvas.width !== videoFrame.displayWidth ||
                    displayCanvas.height !== videoFrame.displayHeight) {
                    displayCanvas.width = videoFrame.displayWidth;
                    displayCanvas.height = videoFrame.displayHeight;
                }

                ctx.drawImage(videoFrame, 0, 0, displayCanvas.width, displayCanvas.height);
                videoFrame.close();

                if (streamLoading) streamLoading.style.display = 'none';

                fpsCounter++;
                const now = Date.now();
                if (now - lastFpsUpdate >= 1000) {
                    statFps.textContent = `${fpsCounter} FPS`;
                    fpsCounter = 0;
                    lastFpsUpdate = now;
                }
            },
            error: (err) => {
                console.error('[WebCodecs Decoder Error]', err);
            }
        });
    }

    // Annex-B H.264 NAL Parser
    function handleBinaryVideoChunk(chunk) {
        if (!videoDecoder) return;

        // Concatenate incoming bytes
        const newBuf = new Uint8Array(nalBuffer.length + chunk.length);
        newBuf.set(nalBuffer);
        newBuf.set(chunk, nalBuffer.length);
        nalBuffer = newBuf;

        // Find NAL unit start codes (00 00 01 or 00 00 00 01)
        const nalUnits = [];
        let startIdx = -1;

        for (let i = 0; i < nalBuffer.length - 3; i++) {
            if (nalBuffer[i] === 0 && nalBuffer[i+1] === 0 &&
               (nalBuffer[i+2] === 1 || (nalBuffer[i+2] === 0 && nalBuffer[i+3] === 1))) {
                if (startIdx !== -1) {
                    nalUnits.push(nalBuffer.subarray(startIdx, i));
                }
                startIdx = (nalBuffer[i+2] === 1) ? i + 3 : i + 4;
                i = startIdx - 1;
            }
        }

        if (startIdx !== -1 && startIdx < nalBuffer.length) {
            nalBuffer = nalBuffer.subarray(startIdx);
        } else {
            nalBuffer = new Uint8Array(0);
        }

        for (const nal of nalUnits) {
            if (nal.length === 0) continue;
            const nalType = nal[0] & 0x1F;

            if (nalType === 7) { // SPS
                spsUnit = nal;
            } else if (nalType === 8) { // PPS
                ppsUnit = nal;
            }

            if (!isDecoderConfigured && spsUnit && ppsUnit) {
                // Dynamically extract codec profile from SPS bytes
                let codecStr = 'avc1.42e01f';
                if (spsUnit.length >= 4) {
                    const p = spsUnit[1].toString(16).padStart(2, '0');
                    const c = spsUnit[2].toString(16).padStart(2, '0');
                    const l = spsUnit[3].toString(16).padStart(2, '0');
                    codecStr = `avc1.${p}${c}${l}`.toLowerCase();
                }

                try {
                    videoDecoder.configure({
                        codec: codecStr,
                        optimizeForLatency: true
                    });
                    isDecoderConfigured = true;
                    console.log(`[WebCodecs] Configured H.264 decoder with codec ${codecStr}`);
                } catch (e) {
                    console.warn('[WebCodecs] Initial configure error, falling back to baseline:', e);
                    videoDecoder.configure({
                        codec: 'avc1.42e01f',
                        optimizeForLatency: true
                    });
                    isDecoderConfigured = true;
                }
            }

            if (isDecoderConfigured) {
                const isKey = (nalType === 5);
                const isDelta = (nalType === 1);

                if (isKey || isDelta) {
                    let fullChunk;
                    if (isKey && spsUnit && ppsUnit) {
                        // Prepend SPS and PPS to IDR keyframe for guaranteed decoding across all devices
                        const totalLen = (4 + spsUnit.length) + (4 + ppsUnit.length) + (4 + nal.length);
                        fullChunk = new Uint8Array(totalLen);
                        let offset = 0;

                        // SPS
                        fullChunk[offset] = 0; fullChunk[offset+1] = 0; fullChunk[offset+2] = 0; fullChunk[offset+3] = 1;
                        offset += 4;
                        fullChunk.set(spsUnit, offset);
                        offset += spsUnit.length;

                        // PPS
                        fullChunk[offset] = 0; fullChunk[offset+1] = 0; fullChunk[offset+2] = 0; fullChunk[offset+3] = 1;
                        offset += 4;
                        fullChunk.set(ppsUnit, offset);
                        offset += ppsUnit.length;

                        // IDR NAL
                        fullChunk[offset] = 0; fullChunk[offset+1] = 0; fullChunk[offset+2] = 0; fullChunk[offset+3] = 1;
                        offset += 4;
                        fullChunk.set(nal, offset);
                    } else {
                        fullChunk = new Uint8Array(4 + nal.length);
                        fullChunk[0] = 0; fullChunk[1] = 0; fullChunk[2] = 0; fullChunk[3] = 1;
                        fullChunk.set(nal, 4);
                    }

                    try {
                        videoDecoder.decode(new EncodedVideoChunk({
                            type: isKey ? 'key' : 'delta',
                            timestamp: performance.now() * 1000,
                            data: fullChunk
                        }));
                    } catch (e) {
                        console.error('[WebCodecs Decode Error]', e);
                    }
                }
            }
        }
    }

    // Fullscreen & Orientation Lock
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(() => {});
                }
            }).catch(() => {});
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        }
    }

    btnFullscreen.addEventListener('click', toggleFullscreen);
    floatingFsBtn.addEventListener('click', toggleFullscreen);

    const btnSwitchDisplay = document.getElementById('btn-switch-display');
    if (btnSwitchDisplay) {
        btnSwitchDisplay.addEventListener('click', () => {
            selectedDisplayId = null;
            viewportPanel.style.display = 'none';
            statsChip.style.display = 'none';
            displayPanel.style.display = 'block';
            requestDisplays();
        });
    }

    btnDisconnect.addEventListener('click', () => {
        releaseWakeLock();
        window.location.reload();
    });

    // Start WebSocket
    connectWebSocket();
})();
