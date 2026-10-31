const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ENUM_EXE = path.join(__dirname, 'native', 'enum_screens.exe');

class DisplayManager {
    constructor() {
        this.displays = [];
        this.lastRefresh = 0;
        this.refresh();
    }

    refresh() {
        if (!fs.existsSync(ENUM_EXE)) {
            console.error(`[DisplayManager] Native binary not found at ${ENUM_EXE}. Please run compile_native.ps1.`);
            // Fallback default
            this.displays = [{
                id: 0,
                name: '\\\\.\\DISPLAY1',
                isPrimary: true,
                left: 0,
                top: 0,
                right: 1920,
                bottom: 1080,
                width: 1920,
                height: 1080
            }];
            return this.displays;
        }

        try {
            const res = spawnSync(ENUM_EXE, [], { encoding: 'utf8' });
            if (res.status === 0 && res.stdout) {
                const parsed = JSON.parse(res.stdout.trim());
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.displays = parsed;
                    this.lastRefresh = Date.now();
                    return this.displays;
                }
            }
        } catch (err) {
            console.error('[DisplayManager] Failed to enumerate displays:', err.message);
        }

        return this.displays;
    }

    getDisplays() {
        if (Date.now() - this.lastRefresh > 5000) {
            this.refresh();
        }
        return this.displays;
    }

    getDisplay(id) {
        const screens = this.getDisplays();
        return screens.find(s => s.id === Number(id)) || null;
    }
}

module.exports = new DisplayManager();
