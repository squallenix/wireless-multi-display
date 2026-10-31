/**
 * Touch and Mouse Input Handler for Client
 * Translates local device interactions into normalized (0.0 to 1.0) desktop input events.
 * Fully supports Fit (Contain), Stretch (Fill), and Zoom (Cover) scaling modes.
 */

class TouchInputHandler {
    constructor(canvas, sendCallback) {
        this.canvas = canvas;
        this.sendCallback = sendCallback;
        this.isEnabled = false;
        this.scaleMode = 'fill'; // 'fill' (stretch / no bars), 'contain' (letterbox), 'cover' (zoom)

        this.lastTouchX = 0;
        this.lastTouchY = 0;
        this.touchStartTime = 0;
        this.hasMoved = false;

        this.pendingMove = null;
        this.rafId = null;

        this.bindEvents();
    }

    enable() {
        this.isEnabled = true;
    }

    disable() {
        this.isEnabled = false;
    }

    setScaleMode(mode) {
        this.scaleMode = mode || 'fill';
    }

    getNormalizedCoordinates(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };

        let renderLeft = rect.left;
        let renderTop = rect.top;
        let renderWidth = rect.width;
        let renderHeight = rect.height;

        const videoW = this.canvas.width;
        const videoH = this.canvas.height;

        if (videoW > 0 && videoH > 0 && this.scaleMode !== 'fill') {
            const videoAspect = videoW / videoH;
            const containerAspect = rect.width / rect.height;

            if (this.scaleMode === 'contain') {
                if (containerAspect > videoAspect) {
                    // Container wider than video -> pillarboxed (bars left/right)
                    renderWidth = rect.height * videoAspect;
                    renderLeft = rect.left + (rect.width - renderWidth) / 2;
                } else {
                    // Container taller than video -> letterboxed (bars top/bottom)
                    renderHeight = rect.width / videoAspect;
                    renderTop = rect.top + (rect.height - renderHeight) / 2;
                }
            } else if (this.scaleMode === 'cover') {
                if (containerAspect > videoAspect) {
                    renderHeight = rect.width / videoAspect;
                    renderTop = rect.top + (rect.height - renderHeight) / 2;
                } else {
                    renderWidth = rect.height * videoAspect;
                    renderLeft = rect.left + (rect.width - renderWidth) / 2;
                }
            }
        }

        const x = (clientX - renderLeft) / renderWidth;
        const y = (clientY - renderTop) / renderHeight;

        return {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y))
        };
    }

    queueMove(coords) {
        this.pendingMove = coords;
        if (!this.rafId) {
            this.rafId = requestAnimationFrame(() => {
                if (this.pendingMove && this.isEnabled) {
                    this.sendCallback({
                        action: 'move',
                        x: this.pendingMove.x,
                        y: this.pendingMove.y
                    });
                }
                this.pendingMove = null;
                this.rafId = null;
            });
        }
    }

    bindEvents() {
        // --- Mouse Events (for Laptop / Desktop clients) ---
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isEnabled) return;
            const coords = this.getNormalizedCoordinates(e.clientX, e.clientY);
            this.queueMove(coords);
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (!this.isEnabled) return;
            const coords = this.getNormalizedCoordinates(e.clientX, e.clientY);
            this.sendCallback({ action: 'move', x: coords.x, y: coords.y });
            this.sendCallback({ action: 'down', button: e.button });
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (!this.isEnabled) return;
            this.sendCallback({ action: 'up', button: e.button });
        });

        this.canvas.addEventListener('wheel', (e) => {
            if (!this.isEnabled) return;
            e.preventDefault();
            this.sendCallback({ action: 'scroll', deltaY: Math.round(-e.deltaY) });
        }, { passive: false });

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // Prevent default browser context menu on canvas
        });

        // --- Touch Events (for Phones / Tablets) ---
        this.canvas.addEventListener('touchstart', (e) => {
            if (!this.isEnabled) return;
            if (e.touches.length === 1) {
                const t = e.touches[0];
                this.lastTouchX = t.clientX;
                this.lastTouchY = t.clientY;
                this.touchStartTime = Date.now();
                this.hasMoved = false;

                const coords = this.getNormalizedCoordinates(t.clientX, t.clientY);
                this.queueMove(coords);
            } else if (e.touches.length === 2) {
                // Two finger tap setup
                this.lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            }
        }, { passive: true });

        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.isEnabled) return;
            e.preventDefault();

            if (e.touches.length === 1) {
                const t = e.touches[0];
                this.hasMoved = true;
                const coords = this.getNormalizedCoordinates(t.clientX, t.clientY);
                this.queueMove(coords);
            } else if (e.touches.length === 2) {
                // Two finger vertical scrolling
                const currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const deltaY = currentY - this.lastTouchY;
                this.lastTouchY = currentY;
                this.sendCallback({ action: 'scroll', deltaY: Math.round(deltaY * 3) });
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            if (!this.isEnabled) return;
            if (e.touches.length === 0) {
                const duration = Date.now() - this.touchStartTime;
                if (!this.hasMoved && duration < 350) {
                    // Tap = Left Click
                    this.sendCallback({ action: 'down', button: 0 });
                    setTimeout(() => {
                        this.sendCallback({ action: 'up', button: 0 });
                    }, 20);
                }
            }
        });
    }
}

window.TouchInputHandler = TouchInputHandler;
