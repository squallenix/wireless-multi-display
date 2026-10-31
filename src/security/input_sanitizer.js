/**
 * Input Sanitizer and Sandboxing Guard
 * Protects host machine against coordinate escaping and arbitrary remote control injection.
 */

class InputSanitizer {
    constructor(config = {}) {
        this.allowKeyboard = config.allowKeyboard || false;
        this.allowedActions = new Set(['move', 'down', 'up', 'scroll', 'ping']);
        this.allowedButtons = new Set([0, 1, 2]); // 0=left, 1=middle, 2=right
    }

    sanitize(rawEvent, display) {
        if (!rawEvent || typeof rawEvent !== 'object') {
            return null;
        }

        const action = String(rawEvent.action || '').trim().toLowerCase();
        if (!this.allowedActions.has(action)) {
            return null;
        }

        if (action === 'ping') {
            return { action: 'ping' };
        }

        if (!display || typeof display.left !== 'number' || typeof display.width !== 'number') {
            return null;
        }

        if (action === 'move') {
            // Normalized coordinates (0.0 to 1.0)
            const nx = Number(rawEvent.x);
            const ny = Number(rawEvent.y);

            if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;

            // Strict clamp to 0.0 - 1.0
            const clampedNormX = Math.max(0.0, Math.min(1.0, nx));
            const clampedNormY = Math.max(0.0, Math.min(1.0, ny));

            // Map to monitor's physical desktop bounds
            const targetX = Math.round(display.left + clampedNormX * display.width);
            const targetY = Math.round(display.top + clampedNormY * display.height);

            // Hard enforce bounding box: can NEVER leave this monitor
            const safeX = Math.max(display.left, Math.min(display.right - 1, targetX));
            const safeY = Math.max(display.top, Math.min(display.bottom - 1, targetY));

            return {
                action: 'move',
                x: safeX,
                y: safeY
            };
        }

        if (action === 'down' || action === 'up') {
            const button = Number(rawEvent.button ?? 0);
            if (!this.allowedButtons.has(button)) return null;

            return {
                action,
                button
            };
        }

        if (action === 'scroll') {
            let deltaY = Number(rawEvent.deltaY || 0);
            if (!Number.isFinite(deltaY)) return null;

            // Clamp max scroll delta to prevent erratic jumps or abuse
            deltaY = Math.max(-1200, Math.min(1200, deltaY));

            return {
                action: 'scroll',
                deltaY: Math.round(deltaY)
            };
        }

        return null;
    }
}

module.exports = InputSanitizer;
