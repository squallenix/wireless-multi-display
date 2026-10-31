# AegisDisplay Client Options (Phone & Laptop)

You can run the AegisDisplay receiver on any phone, tablet, or laptop in 2 easy ways:

---

## 📱 For Smartphones & Tablets (Android, iPhone, iPad)

### Option 1: 1-Tap App Install (Progressive Web App - PWA)
1. On your phone, connect to the same Wi-Fi and open Chrome or Safari:
   ```
   https://<HOST-IP>:8443
   ```
   *(e.g., `https://192.168.10.3:8443`)*
2. Tap the green **"📲 Install App"** button (or tap your browser menu -> **"Add to Home Screen"**).
3. AegisDisplay is now installed on your phone's home screen with its own icon!
4. **Benefits:**
   - **Standalone Window:** Runs with no URL bar, no tabs, and no browser UI.
   - **Auto Landscape:** Automatically rotates and locks in wide monitor mode.
   - **Screen Wake Lock:** The phone screen will **never turn off or sleep** while displaying your PC monitor.
   - **Touch Controls:** Tap to left-click, two fingers to scroll or right-click.

---

## 💻 For Laptops (Windows, macOS, Linux)

### Option 1: 1-Click Native App Launcher (Recommended)
Inside the `client-laptop/` folder:
- **On Windows:** Double-click [`launch_laptop.bat`](launch_laptop.bat).
- **On macOS / Linux:** Run `./launch_laptop.sh`.

**Features:**
- **Auto-Discovery:** Automatically detects the Host PC on your local network (no typing IPs).
- **Standalone Borderless Window:** Launches Edge, Chrome, Brave, or Opera GX in dedicated native App Mode (`--app=https://... --start-fullscreen`).
- **Zero TLS Warnings:** Bypasses self-signed certificate warnings automatically.
- **Built-in Python Mode:** Option 2 in the menu lets you run the low-latency FFplay streaming client directly with automatic dependency installation.

### Option 2: Browser PWA Installation
1. On your laptop, navigate to `https://<HOST-IP>:8443` in Chrome, Edge, Brave, or Opera.
2. Click the **"📲 Install App"** button or the install icon in your browser's address bar.
3. AegisDisplay will install directly to your Windows Start Menu, Taskbar, or Applications folder!

### Option 3: Standalone Python & FFplay Receiver
```bash
pip install websocket-client
python client_laptop.py
```
Streams raw H.264 video chunks directly into `ffplay` with zero buffer delay and video-sync.
