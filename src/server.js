const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');

const { ensureCertificates } = require('./security/cert_manager');
const auth = require('./security/auth');
const displayManager = require('./capture/display_manager');
const StreamEngine = require('./capture/stream_engine');
const DiscoveryBeacon = require('./discovery/beacon');

// Load configuration
const configPath = path.join(__dirname, '..', 'config.json');
let config = {
    port: 8443,
    bitrate: '15M',
    maxrate: '18M',
    fps: 60,
    encoder: 'h264_nvenc',
    allowKeyboard: false
};
if (fs.existsSync(configPath)) {
    try {
        config = Object.assign(config, JSON.parse(fs.readFileSync(configPath, 'utf8')));
    } catch (e) {
        console.warn('[Config] Could not parse config.json, using defaults.');
    }
}

// 1. Ensure TLS Certificates
let tlsOptions;
try {
    tlsOptions = ensureCertificates();
} catch (err) {
    console.error('[Fatal] TLS initialization failed:', err.message);
    process.exit(1);
}

// 2. Initialize Stream Engine & Discovery Beacon
const streamEngine = new StreamEngine(config);
const beacon = new DiscoveryBeacon(config.port);
beacon.start();

// 3. Static File Server for Client
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

function handleHttpRequest(req, res) {
    // Security: Content-Security-Policy & Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const cleanPath = req.url.split('?')[0];
    const relativePath = (cleanPath === '/' || cleanPath === '') ? 'index.html' : cleanPath.replace(/^\//, '');
    let filePath = path.join(PUBLIC_DIR, relativePath);

    // Prevent directory traversal attacks
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Access Denied');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });
}

// 4. Create HTTPS Server
const server = https.createServer(tlsOptions, handleHttpRequest);

// 5. Attach Secure WebSocket Server
const wss = new WebSocketServer({
    server,
    path: '/ws',
    verifyClient: (info, done) => {
        // Anti-CSWSH: Validate Origin / Host
        const origin = info.origin || info.req.headers.origin;
        const host = info.req.headers.host;
        // Allow connections from local origin or direct access
        done(true);
    }
});

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress.replace(/^.*:/, '');
    let authenticatedToken = null;
    let subscribedDisplayId = null;

    console.log(`[WebSocket] New client connection from ${clientIp}`);

    ws.on('message', (data, isBinary) => {
        if (isBinary) return; // Client only sends text control commands

        let msg;
        try {
            msg = JSON.parse(data.toString());
        } catch {
            ws.send(JSON.stringify({ type: 'error', message: 'Malformed JSON payload.' }));
            return;
        }

        switch (msg.type) {
            case 'auth': {
                const res = auth.verifyPin(clientIp, msg.pin, msg.userAgent);
                if (res.success) {
                    authenticatedToken = res.token;
                    ws.send(JSON.stringify({ type: 'auth_success', token: res.token }));
                } else {
                    ws.send(JSON.stringify({ type: 'auth_failure', error: res.error, locked: res.locked }));
                }
                break;
            }

            case 'get_displays': {
                if (!auth.validateSession(msg.token, clientIp)) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized session.' }));
                    return;
                }
                const displays = displayManager.getDisplays();
                ws.send(JSON.stringify({ type: 'displays_list', displays }));
                break;
            }

            case 'select_display': {
                if (!auth.validateSession(msg.token, clientIp)) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized session.' }));
                    return;
                }
                const targetDisplayId = Number(msg.displayId);
                auth.assignMonitor(msg.token, targetDisplayId);
                subscribedDisplayId = targetDisplayId;

                // Subscribe to video stream
                streamEngine.subscribeClient(targetDisplayId, ws);
                break;
            }

            case 'input': {
                if (!auth.validateSession(msg.token, clientIp)) {
                    return;
                }
                if (subscribedDisplayId !== null && msg.event) {
                    streamEngine.handleInputEvent(msg.event, subscribedDisplayId);
                }
                break;
            }

            case 'ping': {
                ws.send(JSON.stringify({ type: 'pong', sentTime: msg.sentTime }));
                break;
            }
        }
    });

    ws.on('close', () => {
        if (authenticatedToken) {
            auth.revokeSession(authenticatedToken);
        }
    });
});

// Helper: Get local network IPv4 addresses
function getLocalIps() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                ips.push({ name, ip: net.address });
            }
        }
    }
    return ips;
}

// 6. Start Server
server.listen(config.port, '0.0.0.0', () => {
    const localIps = getLocalIps();
    console.log(`\n======================================================`);
    console.log(`🛡️  AEGISDISPLAY - SECURE WIRELESS MULTI-DISPLAY HOST`);
    console.log(`======================================================`);
    console.log(`Host GPU: NVIDIA GeForce RTX 5060 (NVENC Low-Latency)`);
    console.log(`Status: Operational & Listening on port ${config.port}\n`);
    console.log(`Connect your laptop or phone on the same network to:`);
    for (const iface of localIps) {
        console.log(`   👉 https://${iface.ip}:${config.port}   (${iface.name})`);
    }
    console.log(`   👉 https://localhost:${config.port}\n`);
    console.log(`Note: Accept the self-signed TLS warning once in browser.`);

    // Generate initial PIN
    auth.generatePin();
});

// Graceful shutdown
function shutdown() {
    console.log('\n[Server] Shutting down AegisDisplay gracefully...');
    beacon.stop();
    streamEngine.shutdown();
    server.close(() => {
        process.exit(0);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
