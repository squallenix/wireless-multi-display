/**
 * AegisDisplay Client Controller
 * WebCodecs Ultra-Low Latency Video Decoder & Diagnostics HUD
 */

(() => {
    let ws = null;
    let sessionToken = null;
    let selectedDisplayId = null;
    let videoDecoder = null;
    let isDecoderConfigured = false;
    let hasReceivedKeyFrame = false;
    let isSubscribed = false;
    let nalBuffer = new Uint8Array(0);
    let spsUnit = null;
    let ppsUnit = null;
    let wakeLock = null;
    let deferredInstallPrompt = null;
    let pingInterval = null;
    let reconnectTimeout = null;
    let fpsCounter = 0;
    let lastFpsUpdate = Date.now();
    let touchHandler = null;

    // Diagnostic Metrics
    const diag = {
        hostStatus: 'Initializing...',
        authStatus: 'Unverified',
        displayId: 'None',
        decoderState: 'Uninitialized',
        codecStr: '--',
        chunksReceived: 0,
        bytesReceived: 0,
        spsCount: 0,
        ppsCount: 0,
        keyCount: 0,
        deltaCount: 0,
        renderedFrames: 0,
        lastError: null
    };

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
    const streamSpinner = document.getElementById('stream-spinner');
    const streamStatusTitle = document.getElementById('stream-status-title');
    const streamStatusSub = document.getElementById('stream-status-sub');
    const btnForceReconnect = document.getElementById('btn-force-reconnect');
    const btnRePair = document.getElementById('btn-re-pair');
    const btnShowDebug = document.getElementById('btn-show-debug');
    const statsChip = document.getElementById('stats-chip');
    const statDot = document.getElementById('stat-dot');
    const statFps = document.getElementById('stat-fps');
    const statLatency = document.getElementById('stat-latency');
    const btnToggleDebug = document.getElementById('btn-toggle-debug');
    const debugOverlay = document.getElementById('debug-overlay');
    const btnCloseDebug = document.getElementById('btn-close-debug');
    const btnFullscreen = document.getElementById('btn-fullscreen-toggle');
    const floatingFsBtn = document.getElementById('floating-fs-btn');
    const btnDisconnect = document.getElementById('btn-disconnect');
    const btnInstallApp = document.getElementById('btn-install-app');

    // Diagnostic Elements
    const diagHostStatus = document.getElementById('diag-host-status');
    const diagAuthStatus = document.getElementById('diag-auth-status');
    const diagDisplayId = document.getElementById('diag-display-id');
    const diagDecoderState = document.getElementById('diag-decoder-state');
    const diagCodecStr = document.getElementById('diag-codec-str');
    const diagNetworkData = document.getElementById('diag-network-data');
    const diagNalsInfo = document.getElementById('diag-nals-info');
    const diagRenderedFrames = document.getElementById('diag-rendered-frames');
    const debugLogConsole = document.getElementById('debug-log-console');

    // 0. Live Diagnostics Logger
    function logDiag(message, type = 'info') {
        const time = new Date().toLocaleTimeString();
        console.log(`[${time}] [${type.toUpperCase()}] ${message}`);

        if (debugLogConsole) {
            const row = document.createElement('div');
            row.className = `log-entry log-${type}`;
            row.textContent = `[${time}] ${message}`;
            debugLogConsole.appendChild(row);
            debugLogConsole.scrollTop = debugLogConsole.scrollHeight;
        }

        updateDiagUI();
    }

    function updateDiagUI() {
        if (diagHostStatus) diagHostStatus.textContent = diag.hostStatus;
        if (diagAuthStatus) diagAuthStatus.textContent = diag.authStatus;
        if (diagDisplayId) diagDisplayId.textContent = diag.displayId;
        if (diagDecoderState) diagDecoderState.textContent = diag.decoderState;
        if (diagCodecStr) diagCodecStr.textContent = diag.codecStr;
        if (diagNetworkData) {
            const kb = Math.round(diag.bytesReceived / 1024);
            const mb = (diag.bytesReceived / (1024 * 1024)).toFixed(1);
            const sizeStr = mb >= 1 ? `${mb} MB` : `${kb} KB`;
            diagNetworkData.textContent = `${diag.chunksReceived} chunks (${sizeStr})`;
        }
        if (diagNalsInfo) {
            diagNalsInfo.textContent = `SPS: ${diag.spsCount}, PPS: ${diag.ppsCount}, IDR: ${diag.keyCount}, P: ${diag.deltaCount}`;
        }
        if (diagRenderedFrames) diagRenderedFrames.textContent = diag.renderedFrames;
    }

    function setStatusOverlay(title, sub, showSpinner = true, showReconnect = false, showPair = false) {
        if (streamStatusTitle) streamStatusTitle.textContent = title;
        if (streamStatusSub) streamStatusSub.textContent = sub;
        if (streamSpinner) streamSpinner.style.display = showSpinner ? 'block' : 'none';
        if (btnForceReconnect) btnForceReconnect.style.display = showReconnect ? 'inline-block' : 'none';
        if (btnRePair) btnRePair.style.display = showPair ? 'inline-block' : 'none';
    }

    // Toggle Diagnostics HUD
    function toggleDebugOverlay() {
        if (!debugOverlay) return;
        const isHidden = (debugOverlay.style.display === 'none' || !debugOverlay.style.display);
        debugOverlay.style.display = isHidden ? 'flex' : 'none';
    }

    if (btnToggleDebug) btnToggleDebug.addEventListener('click', toggleDebugOverlay);
    if (btnShowDebug) btnShowDebug.addEventListener('click', toggleDebugOverlay);
    if (btnCloseDebug) btnCloseDebug.addEventListener('click', () => { debugOverlay.style.display = 'none'; });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'd' || e.key === 'D') {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
            toggleDebugOverlay();
        }
    });

    // 1. Service Worker & PWA Installation
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
                logDiag(`ServiceWorker note: ${err.message}`, 'warn');
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
                    logDiag(`PWA Install prompt outcome: ${outcome}`, 'info');
                    deferredInstallPrompt = null;
                    btnInstallApp.style.display = 'none';
                }
            });
        }
    });

    // 2. Screen Wake Lock
    async function acquireWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                logDiag('Screen Wake Lock acquired (display will not sleep).', 'info');
                wakeLock.addEventListener('release', () => { wakeLock = null; });
            } catch (err) {
                logDiag(`WakeLock note: ${err.message}`, 'warn');
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
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }

        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${proto}//${window.location.host}/ws`;

        logDiag(`Connecting to Host at ${url}...`, 'info');
        diag.hostStatus = 'Connecting...';
        setStatusOverlay('Connecting to Host PC...', `Contacting ${window.location.host}...`, true, false, false);

        try {
            ws = new WebSocket(url);
            ws.binaryType = 'arraybuffer';
        } catch (err) {
            handleConnectionFailure(`Socket creation error: ${err.message}`);
            return;
        }

        ws.onopen = () => {
            logDiag('WebSocket secure connection ESTABLISHED!', 'success');
            diag.hostStatus = '🟢 Connected';
            if (statDot) statDot.style.backgroundColor = '#238636';

            const savedToken = sessionStorage.getItem('aegis_token');
            if (savedToken) {
                logDiag('Found saved session token. Verifying session with host...', 'info');
                sessionToken = savedToken;
                diag.authStatus = 'Verifying...';
                setStatusOverlay('Verifying Session...', 'Restoring your previous device pairing...', true, false, false);
                requestDisplays();
            } else {
                diag.authStatus = 'Waiting for PIN';
                if (viewportPanel.style.display !== 'flex') {
                    authPanel.style.display = 'block';
                    displayPanel.style.display = 'none';
                } else {
                    setStatusOverlay('Device Pairing Required', 'Please enter your Host PC PIN.', false, false, true);
                }
            }
        };

        ws.onmessage = (event) => {
            if (typeof event.data === 'string') {
                try {
                    handleJsonMessage(JSON.parse(event.data));
                } catch (e) {
                    logDiag(`Malformed JSON message: ${e.message}`, 'warn');
                }
            } else if (event.data instanceof ArrayBuffer) {
                handleBinaryVideoChunk(new Uint8Array(event.data));
            }
        };

        ws.onclose = (event) => {
            handleConnectionFailure(`Disconnected from host (code: ${event.code})`);
        };

        ws.onerror = (err) => {
            handleConnectionFailure('WebSocket encountered network error');
        };
    }

    function handleConnectionFailure(reason) {
        logDiag(`Connection Alert: ${reason}`, 'warn');
        diag.hostStatus = '🔴 Disconnected';
        if (statDot) statDot.style.backgroundColor = '#da3633';
        if (statLatency) statLatency.textContent = 'Offline';

        setStatusOverlay(
            '🔴 Host PC Offline',
            `Could not reach host at ${window.location.host}. Make sure start.bat is running on your Host PC.`,
            false,
            true,
            true
        );

        releaseWakeLock();

        // Schedule auto-reconnect
        if (!reconnectTimeout) {
            reconnectTimeout = setTimeout(() => {
                logDiag('Auto-reconnecting to host...', 'info');
                connectWebSocket();
            }, 3000);
        }
    }

    if (btnForceReconnect) {
        btnForceReconnect.addEventListener('click', () => {
            logDiag('User clicked manual reconnect.', 'info');
            connectWebSocket();
        });
    }

    if (btnRePair) {
        btnRePair.addEventListener('click', () => {
            sessionStorage.removeItem('aegis_token');
            sessionToken = null;
            isSubscribed = false;
            selectedDisplayId = null;
            viewportPanel.style.display = 'none';
            displayPanel.style.display = 'none';
            authPanel.style.display = 'block';
            hideAuthError();
        });
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
        logDiag(`Submitting PIN [${pin}] to host server...`, 'info');
        diag.authStatus = 'Authenticating...';

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
                sessionStorage.setItem('aegis_token', msg.token);
                diag.authStatus = '🟢 Paired (Verified)';
                logDiag('Pairing SUCCESS! Session token acquired.', 'success');
                authPanel.style.display = 'none';
                displayPanel.style.display = 'block';
                requestDisplays();
                break;

            case 'auth_failure':
                sessionStorage.removeItem('aegis_token');
                diag.authStatus = '🔴 Auth Failed';
                logDiag(`Authentication FAILED: ${msg.error}`, 'error');
                showAuthError(msg.error || 'Authentication failed.');
                break;

            case 'displays_list':
                authPanel.style.display = 'none';
                renderDisplays(msg.displays);
                break;

            case 'pong':
                if (msg.sentTime) {
                    const rtt = Date.now() - msg.sentTime;
                    statLatency.textContent = `${rtt} ms`;
                }
                break;

            case 'error':
                logDiag(`Host Error: ${msg.message}`, 'error');
                if (msg.message && msg.message.toLowerCase().includes('unauthorized')) {
                    sessionStorage.removeItem('aegis_token');
                    sessionToken = null;
                    isSubscribed = false;
                    selectedDisplayId = null;
                    diag.authStatus = 'Session Expired';
                    if (pingInterval) clearInterval(pingInterval);
                    authPanel.style.display = 'block';
                    displayPanel.style.display = 'none';
                    viewportPanel.style.display = 'none';
                    statsChip.style.display = 'none';
                    showAuthError('Session expired or host restarted. Enter current terminal PIN.');
                }
                break;
        }
    }

    function requestDisplays() {
        logDiag('Requesting active displays list from host...', 'info');
        sendJson({
            type: 'get_displays',
            token: sessionToken
        });
    }

    btnRefresh.addEventListener('click', requestDisplays);

    function renderDisplays(displays) {
        displayList.innerHTML = '';
        if (!displays || displays.length === 0) {
            displayList.innerHTML = '<p style="color:#8b949e;">No active displays detected on host.</p>';
            logDiag('Host returned 0 active displays.', 'warn');
            return;
        }

        logDiag(`Host detected ${displays.length} monitor(s): ${displays.map(d => `${d.name} (${d.width}x${d.height}, Primary: ${d.isPrimary})`).join(', ')}`, 'info');

        // Auto-detect Extended Monitor (isPrimary === false)
        const targetDisplay = displays.find(d => !d.isPrimary) || displays[0];
        if (targetDisplay && !isSubscribed) {
            logDiag(`Auto-selecting display: ${targetDisplay.name} (${targetDisplay.width}x${targetDisplay.height})`, 'success');
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
        if (isSubscribed && selectedDisplayId === id) return;
        isSubscribed = true;
        selectedDisplayId = id;
        diag.displayId = `Display ${id} (${displayInfo ? `${displayInfo.width}x${displayInfo.height}` : 'Active'})`;

        displayPanel.style.display = 'none';
        viewportPanel.style.display = 'flex';
        statsChip.style.display = 'flex';

        setStatusOverlay(
            `Connecting to Display ${id}...`,
            'Starting NVIDIA GPU hardware encoder and requesting video stream...',
            true, false, false
        );

        acquireWakeLock();
        initWebCodecsDecoder();

        // Initialize touch & mouse input handler
        if (!touchHandler) {
            touchHandler = new window.TouchInputHandler(displayCanvas, (inputEvent) => {
                sendJson({
                    type: 'input',
                    token: sessionToken,
                    event: inputEvent
                });
            });
            touchHandler.enable();
        }

        // Subscribe to display video stream
        logDiag(`Subscribing to Display ${id} stream...`, 'info');
        sendJson({
            type: 'select_display',
            token: sessionToken,
            displayId: id
        });

        // Ping loop for latency tracking
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            sendJson({
                type: 'ping',
                sentTime: Date.now()
            });
        }, 1500);
    }

    // Step 3: WebCodecs Hardware Video Decoding
    function resetDecoder() {
        logDiag('Resetting WebCodecs decoder state...', 'warn');
        isDecoderConfigured = false;
        hasReceivedKeyFrame = false;
        spsUnit = null;
        ppsUnit = null;
        nalBuffer = new Uint8Array(0);
        diag.decoderState = 'Resetting...';

        if (videoDecoder && videoDecoder.state !== 'closed') {
            try { videoDecoder.close(); } catch {}
        }
        initWebCodecsDecoder();
    }

    function initWebCodecsDecoder() {
        if (!('VideoDecoder' in window)) {
            const err = 'Your browser does not support WebCodecs. Please update Chrome, Edge, Safari 16.4+, or Opera.';
            logDiag(err, 'error');
            alert(err);
            return;
        }

        try {
            videoDecoder = new VideoDecoder({
                output: (videoFrame) => {
                    if (displayCanvas.width !== videoFrame.displayWidth ||
                        displayCanvas.height !== videoFrame.displayHeight) {
                        displayCanvas.width = videoFrame.displayWidth;
                        displayCanvas.height = videoFrame.displayHeight;
                    }

                    ctx.drawImage(videoFrame, 0, 0, displayCanvas.width, displayCanvas.height);
                    videoFrame.close();

                    if (streamLoading && streamLoading.style.display !== 'none') {
                        streamLoading.style.display = 'none';
                        logDiag(`First video frame displayed on canvas! (${displayCanvas.width}x${displayCanvas.height})`, 'success');
                    }

                    diag.renderedFrames++;
                    fpsCounter++;
                    const now = Date.now();
                    if (now - lastFpsUpdate >= 1000) {
                        statFps.textContent = `${fpsCounter} FPS`;
                        fpsCounter = 0;
                        lastFpsUpdate = now;
                    }
                    updateDiagUI();
                },
                error: (err) => {
                    logDiag(`WebCodecs Fatal Error: ${err.message}`, 'error');
                    diag.decoderState = `🔴 Error: ${err.message}`;
                    resetDecoder();
                }
            });
            diag.decoderState = 'Ready (Awaiting SPS/PPS)';
            logDiag('WebCodecs VideoDecoder initialized and ready.', 'info');
        } catch (e) {
            logDiag(`WebCodecs Init Exception: ${e.message}`, 'error');
            diag.decoderState = `Init Failed: ${e.message}`;
        }
    }

    // Helper: Find 3-byte and 4-byte Annex B start codes
    function findStartCodes(buffer) {
        const list = [];
        const len = buffer.length;
        for (let i = 0; i < len - 3; i++) {
            if (buffer[i] === 0 && buffer[i+1] === 0) {
                if (buffer[i+2] === 1) {
                    list.push({ index: i, length: 3 });
                    i += 2;
                } else if (buffer[i+2] === 0 && buffer[i+3] === 1) {
                    list.push({ index: i, length: 4 });
                    i += 3;
                }
            }
        }
        if (len >= 3 && buffer[len-3] === 0 && buffer[len-2] === 0 && buffer[len-1] === 1) {
            if (list.length === 0 || list[list.length - 1].index !== len - 3) {
                list.push({ index: len - 3, length: 3 });
            }
        }
        return list;
    }

    // Annex-B H.264 NAL Parser & Frame Dispatcher
    function handleBinaryVideoChunk(chunk) {
        if (!videoDecoder) return;

        diag.chunksReceived++;
        diag.bytesReceived += chunk.length;

        // Prevent memory overflow on unbounded buffer
        if (nalBuffer.length > 8 * 1024 * 1024) {
            logDiag('Stream buffer exceeded 8MB, resetting buffer.', 'warn');
            nalBuffer = new Uint8Array(0);
        }

        // Concatenate incoming bytes
        const combined = new Uint8Array(nalBuffer.length + chunk.length);
        combined.set(nalBuffer);
        combined.set(chunk, nalBuffer.length);
        nalBuffer = combined;

        const startCodes = findStartCodes(nalBuffer);
        if (startCodes.length < 2) {
            return;
        }

        const nalUnits = [];
        for (let k = 0; k < startCodes.length - 1; k++) {
            const start = startCodes[k].index + startCodes[k].length;
            const end = startCodes[k + 1].index;
            if (end > start) {
                nalUnits.push(nalBuffer.subarray(start, end));
            }
        }
        nalBuffer = nalBuffer.subarray(startCodes[startCodes.length - 1].index);

        for (const nal of nalUnits) {
            if (nal.length === 0) continue;
            const nalType = nal[0] & 0x1F;

            if (nalType === 7) { // SPS
                spsUnit = nal;
                diag.spsCount++;
            } else if (nalType === 8) { // PPS
                ppsUnit = nal;
                diag.ppsCount++;
            } else if (nalType === 5) {
                diag.keyCount++;
            } else if (nalType === 1) {
                diag.deltaCount++;
            }

            // Configure decoder on first SPS/PPS pair
            if (!isDecoderConfigured && spsUnit && ppsUnit) {
                let codecStr = 'avc1.42e01f';
                if (spsUnit.length >= 4) {
                    const p = spsUnit[1].toString(16).padStart(2, '0');
                    const c = spsUnit[2].toString(16).padStart(2, '0');
                    const l = spsUnit[3].toString(16).padStart(2, '0');
                    codecStr = `avc1.${p}${c}${l}`.toLowerCase();
                }

                diag.codecStr = codecStr;
                try {
                    videoDecoder.configure({
                        codec: codecStr,
                        optimizeForLatency: true
                    });
                    isDecoderConfigured = true;
                    diag.decoderState = `🟢 Configured (${codecStr})`;
                    logDiag(`Configured H.264 decoder with codec: ${codecStr}`, 'success');
                } catch (e) {
                    logDiag(`Configure error for ${codecStr}, falling back to baseline: ${e.message}`, 'warn');
                    videoDecoder.configure({
                        codec: 'avc1.42e01f',
                        optimizeForLatency: true
                    });
                    isDecoderConfigured = true;
                    diag.decoderState = '🟢 Baseline Configured';
                }
            }

            if (isDecoderConfigured) {
                const isKey = (nalType === 5);
                const isDelta = (nalType === 1);

                if (!isKey && !isDelta) continue;

                // Essential: WebCodecs closes with DataError if fed delta before first keyframe!
                if (!hasReceivedKeyFrame) {
                    if (!isKey) {
                        continue; // Discard delta frames until the first keyframe arrives
                    }
                    hasReceivedKeyFrame = true;
                    logDiag('First IDR Keyframe received! Beginning live decode.', 'success');
                }

                let fullChunk;
                if (isKey && spsUnit && ppsUnit) {
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
                        timestamp: Math.round(performance.now() * 1000),
                        data: fullChunk
                    }));
                } catch (e) {
                    logDiag(`Decode Error: ${e.message}`, 'error');
                    if (videoDecoder && videoDecoder.state === 'closed') {
                        resetDecoder();
                    }
                }
            }
        }

        // Update progress in overlay while still waiting for initial frame
        if (streamLoading && streamLoading.style.display !== 'none' && diag.chunksReceived > 0) {
            setStatusOverlay(
                'Receiving Video Stream...',
                `Received ${diag.chunksReceived} chunks (${Math.round(diag.bytesReceived / 1024)} KB). Synchronizing GPU keyframe...`,
                true, false, false
            );
        }

        updateDiagUI();
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
            isSubscribed = false;
            selectedDisplayId = null;
            if (pingInterval) clearInterval(pingInterval);
            viewportPanel.style.display = 'none';
            statsChip.style.display = 'none';
            displayPanel.style.display = 'block';
            requestDisplays();
        });
    }

    btnDisconnect.addEventListener('click', () => {
        isSubscribed = false;
        sessionStorage.removeItem('aegis_token');
        releaseWakeLock();
        window.location.reload();
    });

    // Start WebSocket
    connectWebSocket();
})();
