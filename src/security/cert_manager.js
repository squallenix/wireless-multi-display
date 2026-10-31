const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CERTS_DIR = path.join(__dirname, '..', '..', 'certs');
const KEY_PATH = path.join(CERTS_DIR, 'server.key');
const CERT_PATH = path.join(CERTS_DIR, 'server.crt');

function ensureCertificates() {
    if (!fs.existsSync(CERTS_DIR)) {
        fs.mkdirSync(CERTS_DIR, { recursive: true });
    }

    if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
        return {
            key: fs.readFileSync(KEY_PATH),
            cert: fs.readFileSync(CERT_PATH)
        };
    }

    console.log('[Security] Generating new self-signed TLS certificates for encrypted HTTPS/WSS...');

    const opensslCandidates = [
        { bin: 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe', cnf: 'C:\\Program Files\\Git\\usr\\ssl\\openssl.cnf' },
        { bin: 'C:\\msys64\\usr\\bin\\openssl.exe', cnf: 'C:\\msys64\\etc\\ssl\\openssl.cnf' },
        { bin: 'openssl', cnf: null }
    ];

    for (const item of opensslCandidates) {
        try {
            const check = spawnSync(item.bin, ['version']);
            if (check.status === 0) {
                const args = [
                    'req', '-x509',
                    '-newkey', 'rsa:2048',
                    '-nodes',
                    '-keyout', KEY_PATH,
                    '-out', CERT_PATH,
                    '-days', '365',
                    '-subj', '/CN=AegisDisplay-Host/O=SecureLocalLAN'
                ];
                if (item.cnf && fs.existsSync(item.cnf)) {
                    args.push('-config', item.cnf);
                }

                const env = { ...process.env };
                delete env.OPENSSL_CONF;

                const res = spawnSync(item.bin, args, { env });
                if (res.status === 0 && fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
                    console.log('[Security] Generated RSA 2048-bit TLS certificates successfully.');
                    return {
                        key: fs.readFileSync(KEY_PATH),
                        cert: fs.readFileSync(CERT_PATH)
                    };
                }
            }
        } catch {
            // continue searching
        }
    }

    throw new Error('TLS Certificate generation failed. Please supply server.key and server.crt in /certs.');
}

module.exports = {
    ensureCertificates,
    KEY_PATH,
    CERT_PATH
};
