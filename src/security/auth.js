const crypto = require('crypto');

class SecurityAuth {
    constructor() {
        this.currentPin = null;
        this.pinCreatedAt = null;
        this.pinExpiresInMs = 10 * 60 * 1000; // 10 minutes
        this.activeSessions = new Map(); // token -> { ip, userAgent, createdAt, monitorId }
        this.failedAttempts = new Map(); // ip -> { count, lockedUntil }
        this.maxAttempts = 3;
        this.lockoutDurationMs = 5 * 60 * 1000; // 5 minutes lockout
    }

    generatePin() {
        this.currentPin = crypto.randomInt(100000, 999999).toString();
        this.pinCreatedAt = Date.now();
        console.log(`\n======================================================`);
        console.log(`[AUTH] NEW PAIRING PIN GENERATED: >>> ${this.currentPin} <<<`);
        console.log(`[AUTH] Enter this PIN on your laptop/phone to pair.`);
        console.log(`[AUTH] Valid for 10 minutes. Max 3 incorrect attempts.`);
        console.log(`======================================================\n`);
        return this.currentPin;
    }

    getCurrentPin() {
        if (!this.currentPin || (Date.now() - this.pinCreatedAt > this.pinExpiresInMs)) {
            return this.generatePin();
        }
        return this.currentPin;
    }

    isIpLocked(ip) {
        const record = this.failedAttempts.get(ip);
        if (!record) return false;
        if (record.lockedUntil && Date.now() < record.lockedUntil) {
            return true;
        }
        if (record.lockedUntil && Date.now() >= record.lockedUntil) {
            this.failedAttempts.delete(ip);
            return false;
        }
        return false;
    }

    getLockoutRemainingSeconds(ip) {
        const record = this.failedAttempts.get(ip);
        if (!record || !record.lockedUntil) return 0;
        return Math.max(0, Math.ceil((record.lockedUntil - Date.now()) / 1000));
    }

    verifyPin(ip, candidatePin, userAgent = '') {
        if (this.isIpLocked(ip)) {
            const remaining = this.getLockoutRemainingSeconds(ip);
            return {
                success: false,
                error: `Too many failed attempts. IP blocked for ${remaining} more seconds.`,
                locked: true
            };
        }

        // Check PIN expiry
        if (!this.currentPin || (Date.now() - this.pinCreatedAt > this.pinExpiresInMs)) {
            this.generatePin();
        }

        // Timing-safe comparison to prevent side-channel timing attacks
        const pinBuffer = Buffer.from(this.currentPin);
        const candBuffer = Buffer.from(String(candidatePin || ''));

        const match = pinBuffer.length === candBuffer.length &&
                      crypto.timingSafeEqual(pinBuffer, candBuffer);

        if (!match) {
            let record = this.failedAttempts.get(ip) || { count: 0, lockedUntil: null };
            record.count += 1;
            if (record.count >= this.maxAttempts) {
                record.lockedUntil = Date.now() + this.lockoutDurationMs;
                this.failedAttempts.set(ip, record);
                console.warn(`[SECURITY ALERT] IP ${ip} exceeded maximum failed PIN attempts. Locked out for 5 minutes.`);
                return {
                    success: false,
                    error: `Too many failed attempts. Locked out for 5 minutes.`,
                    locked: true
                };
            } else {
                this.failedAttempts.set(ip, record);
                const remaining = this.maxAttempts - record.count;
                console.warn(`[Security] Failed PIN attempt from ${ip}. Remaining attempts before lockout: ${remaining}`);
                return {
                    success: false,
                    error: `Invalid PIN. ${remaining} attempt(s) remaining before IP lockout.`,
                    locked: false
                };
            }
        }

        // PIN is valid: clear failure history for this IP
        this.failedAttempts.delete(ip);

        // Issue cryptographically secure 256-bit session token
        const token = crypto.randomBytes(32).toString('hex');
        this.activeSessions.set(token, {
            ip,
            userAgent,
            createdAt: Date.now(),
            monitorId: null
        });

        // Rotate PIN after successful pairing
        this.generatePin();

        console.log(`[Security] Client paired successfully from ${ip} (${userAgent || 'unknown'}).`);
        return {
            success: true,
            token
        };
    }

    validateSession(token, ip) {
        if (!token || typeof token !== 'string') return false;
        const session = this.activeSessions.get(token);
        if (!session) return false;
        // Verify IP binding (can be loosened if subnet roam is needed, but keeps high security)
        if (session.ip !== ip && !session.ip.startsWith('127.') && !session.ip.startsWith('::1')) {
            console.warn(`[Security Alert] Session token hijacked or IP mismatch: token IP ${session.ip} vs request IP ${ip}`);
            return false;
        }
        return true;
    }

    assignMonitor(token, monitorId) {
        const session = this.activeSessions.get(token);
        if (session) {
            session.monitorId = monitorId;
            return true;
        }
        return false;
    }

    getSession(token) {
        return this.activeSessions.get(token) || null;
    }

    revokeSession(token) {
        this.activeSessions.delete(token);
    }
}

module.exports = new SecurityAuth();
