const dgram = require('dgram');
const os = require('os');

class DiscoveryBeacon {
    constructor(port = 8443, beaconPort = 8444) {
        this.port = port;
        this.beaconPort = beaconPort;
        this.socket = null;
        this.broadcastInterval = null;
    }

    getLocalIp() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    return net.address;
                }
            }
        }
        return '127.0.0.1';
    }

    start() {
        try {
            this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

            this.socket.on('error', (err) => {
                console.warn('[DiscoveryBeacon] UDP error:', err.message);
            });

            this.socket.on('message', (msg, rinfo) => {
                const text = msg.toString().trim();
                if (text.includes('AEGIS_DISCOVER')) {
                    const reply = JSON.stringify({
                        type: 'AEGIS_ANNOUNCE',
                        host: os.hostname(),
                        ip: this.getLocalIp(),
                        port: this.port
                    });
                    this.socket.send(reply, rinfo.port, rinfo.address);
                }
            });

            this.socket.bind(this.beaconPort, () => {
                try {
                    this.socket.setBroadcast(true);
                    console.log(`[DiscoveryBeacon] Auto-discovery beacon active on UDP port ${this.beaconPort}.`);

                    // Periodically announce presence on local subnet
                    this.broadcastInterval = setInterval(() => {
                        const announce = JSON.stringify({
                            type: 'AEGIS_ANNOUNCE',
                            host: os.hostname(),
                            ip: this.getLocalIp(),
                            port: this.port
                        });
                        this.socket.send(announce, this.beaconPort, '255.255.255.255');
                    }, 3000);
                } catch (e) {
                    console.warn('[DiscoveryBeacon] Could not enable broadcast mode:', e.message);
                }
            });

        } catch (err) {
            console.warn('[DiscoveryBeacon] Failed to start beacon:', err.message);
        }
    }

    stop() {
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }
        if (this.socket) {
            try { this.socket.close(); } catch {}
            this.socket = null;
        }
    }
}

module.exports = DiscoveryBeacon;
