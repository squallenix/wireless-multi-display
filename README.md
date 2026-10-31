# AegisDisplay: Secure, Ultra-Low Latency Wireless Multi-Display System

Turn any laptop, smartphone, or tablet on your local network (Wi-Fi or LAN) into a high-performance 2nd, 3rd, or 4th monitor for your Windows PC, with physical-cable-like responsiveness (~8–15 ms latency), zero black bars, and enterprise-grade zero-trust security.

---

## 🏗️ Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                                 HOST PC (Windows)                                 |
|                                                                                   |
|  [ Virtual Display Driver (IddCx) ] ---> Creates true native 16:9 extended screens|
|                  |                                                                |
|                  v                                                                |
|  [ DXGI / GDI Capture Pipeline ]   ---> Zero-copy GPU frame capture (< 1 ms)      |
|                  |                                                                |
|                  v                                                                |
|  [ NVIDIA NVENC (RTX 5060/40/30) ] ---> H.264 Ultra-Low Latency (p1/ull/CBR/yuv420)|
|                  |                                                                |
|                  v                                                                |
|  [ TLS / HTTPS & Secure WSS ]      ---> Encrypted transport with 6-digit PIN auth |
|                  |                                                                |
|                  v                                                                |
|  [ UDP Discovery Beacon (:8444) ]  ---> Automatic LAN host discovery (Zero-Config)|
+-----------------------------------------------------------------------------------+
                                           |
                           Local Wi-Fi (5GHz/6GHz) or LAN
                                           |
+-----------------------------------------------------------------------------------+
|                        CLIENT DEVICE (Laptop, Phone, Tablet)                      |
|                                                                                   |
|  [ WebCodecs API (HTML5) ]         ---> Zero-delay hardware video decoding (<3ms) |
|                  |                                                                |
|                  v                                                                |
|  [ GPU <canvas> Viewport ]         ---> Edge-to-edge scaling (Fill / Fit / Zoom)  |
|                  |                                                                |
|                  v                                                                |
|  [ Sandboxed Input Backchannel ]   ---> Pixel-perfect mouse & touch clamped to mon|
+-----------------------------------------------------------------------------------+
```

---

## 📦 Downloads & Releases

| Platform | Download Asset | Description |
| :--- | :--- | :--- |
| **Android (Phone / Tablet)** | [**`AegisDisplay-v1.0.1.apk`**](releases/AegisDisplay-v1.0.1.apk) | Native Android app with UDP auto-discovery, landscape lock, and wake-lock. |
| **Windows / macOS / Linux Laptop** | [**`AegisDisplay-Laptop-Client-v1.0.1.zip`**](releases/AegisDisplay-Laptop-Client-v1.0.1.zip) | Standalone launcher with LAN auto-discovery and borderless kiosk mode. |
| **Web Browser (Zero-Install)** | Navigate to `https://<HOST-IP>:8443` | Works instantly in Chrome, Edge, Brave, Opera GX, and Safari (iOS/macOS). |

---

## 🚀 Key Features

* **⚡ Ultra-Low Latency (~8–15 ms):** NVIDIA NVENC hardware encoding combined with client-side WebCodecs hardware decoding ensures instantaneous responsiveness.
* **🛡️ Zero-Trust Security:** Mandatory TLS encryption, rolling 6-digit PIN authentication, brute-force IP rate-limiting, and strict input sandboxing.
* **🌐 UDP LAN Auto-Discovery:** Receivers automatically locate the host server on the local network—no manual IP configuration required.
* **🖥️ Native Virtual Extended Displays:** Includes signed IddCx driver installer to spawn true second and third monitors without physical cables or dummy plugs.
* **📐 Zero Black Bars (Aspect Ratio Scaling):** Flexible display scaling modes (**Fill Screen**, **Fit**, **Zoom**) eliminate pillarboxing and letterboxing while maintaining pixel-accurate input mapping.
* **🛠️ Built-in Diagnostics HUD:** Real-time on-screen metrics (FPS, network throughput, latency, H.264 NAL parsing stats, and live event log).

---

## 🏁 Quick Start Guide

### Step 1: Install the Virtual Extended Monitor (Host PC)
To create an extended monitor without physical dummy plugs:
1. Right-click **[`install_virtual_monitor.bat`](install_virtual_monitor.bat)** and select **Run as Administrator**.
2. This automatically trusts the driver certificate, deploys the **16:9 widescreen profile** to `C:\VirtualDisplayDriver\`, and initializes the virtual monitor.

*(To configure resolution at any time, run [`configure_display_resolution.bat`](configure_display_resolution.bat) and choose 1920×1080 or 1366×768).*

### Step 2: Start the Host Server
Simply double-click **[`start.bat`](start.bat)** (or execute `node src/server.js`).

The console will display:
```
======================================================
🛡️  AEGISDISPLAY - SECURE WIRELESS MULTI-DISPLAY HOST
======================================================
Host GPU: NVIDIA GeForce RTX 5060 (NVENC Low-Latency)
Status: Operational & Listening on port 8443

Connect your laptop or phone on the same network to:
   👉 https://192.168.10.3:8443   (Ethernet)
   👉 https://localhost:8443

======================================================
[AUTH] NEW PAIRING PIN GENERATED: >>> 729104 <<<
[AUTH] Enter this PIN on your laptop/phone to pair.
======================================================
```

### Step 3: Connect Receiver Device

#### Option A: On a Laptop (Windows / macOS / Linux)
1. Extract `AegisDisplay-Laptop-Client-v1.0.1.zip` or open the `client-laptop/` folder.
2. Double-click **[`launch_laptop.bat`](client-laptop/launch_laptop.bat)** (or run `./launch_laptop.sh` on macOS/Linux).
3. The launcher automatically detects the host PC via UDP and opens in borderless fullscreen mode.
4. Enter the **6-digit PIN** displayed on the host PC console.

#### Option B: On an Android Phone / Tablet
1. Install **[`AegisDisplay-v1.0.1.apk`](releases/AegisDisplay-v1.0.1.apk)**.
2. Launch the app—it will discover your PC automatically.
3. Enter the **6-digit PIN** to connect.

#### Option C: In Any Web Browser (No Installation)
1. Open Chrome, Edge, Brave, Opera GX, or Safari on the client.
2. Navigate to `https://<HOST-PC-IP>:8443` (e.g. `https://192.168.10.3:8443`).
3. Accept the self-signed TLS warning once.
4. Enter the **6-digit PIN** and select the extended monitor.

---

## 📐 Aspect Ratio & Eliminating Black Bars

If your client screen has vertical or horizontal black bars:

1. **Client-Side Instant Scaling:**
   * Click **`📐 Fill Screen`** in the top stats bar or tap the floating **`📐`** button on mobile.
   * You can also press **`A`** on the keyboard to cycle modes:
     * **Fill Screen** (`object-fit: fill`): Stretches video edge-to-edge, removing all black bars.
     * **Fit (Letterbox)** (`object-fit: contain`): Preserves native monitor aspect ratio.
     * **Zoom (Crop)** (`object-fit: cover`): Zooms to fill screen while preserving proportions.
2. **Host-Side Resolution Matching:**
   * Run **[`configure_display_resolution.bat`](configure_display_resolution.bat)** to open Windows Display Settings.
   * Select **Monitor 2** (the virtual monitor).
   * Set **Display resolution** to **1920×1080** (or **1366×768** to match your laptop).
   * Click **Keep changes**. Windows will now render in native 16:9 widescreen.

---

## 🛠️ Diagnostics HUD & Monitoring

AegisDisplay includes a built-in real-time diagnostics HUD to monitor performance:

* **Open Diagnostics:** Click the **`🛠️ Debug`** button in the top bar or press the **`D`** key.
* **Tracked Metrics:**
  * Host Server connection & ping round-trip latency.
  * Active display resolution & scaling mode.
  * WebCodecs decoder state and H.264 profile string.
  * Data throughput (KB / MB received and chunk counts).
  * H.264 NAL parsing counts (SPS, PPS, IDR keyframes, P delta-frames).
  * Rendered frame counter and real-time FPS counter.
  * Live rolling event log console.
* **Server Health REST Endpoint:**
  * Query `GET https://<HOST-IP>:8443/api/status` for server uptime, active encoders, and viewer counts.

---

## 🔒 Security Architecture (Zero-Trust)

1. **End-to-End Encryption (TLS / HTTPS & WSS):**
   * All video feeds and input commands are transmitted over TLS with 2048-bit RSA keys.
   * Unencrypted HTTP and insecure WebSockets are rejected.
2. **Cryptographic Device Pairing (One-Time PIN):**
   * Authentication requires a 6-digit rolling PIN generated exclusively on the host terminal.
   * PIN verification uses constant-time string comparison (`crypto.timingSafeEqual`) to eliminate timing side-channel attacks.
3. **Brute-Force Lockout Protection:**
   * After **3 incorrect PIN attempts**, the offending IP address is locked out for 5 minutes.
4. **Input Sandboxing & Coordinate Clamping:**
   * Mouse and touch coordinates sent by the client are strictly normalized (0.0 to 1.0) and clamped to the bounding rectangle of the assigned monitor.
   * Remote clients cannot navigate to or click on the primary monitor or Windows taskbar.
   * Keystroke injection is disabled by default to prevent unauthorized command execution.
5. **Anti-CSWSH & Origin Validation:**
   * WebSocket handshakes validate the `Origin` and `Host` headers to prevent Cross-Site WebSocket Hijacking and DNS rebinding attacks.

---

## ⚙️ Configuration (`config.json`)

You can customize performance and security settings in `config.json`:

```json
{
  "port": 8443,
  "bitrate": "15M",
  "maxrate": "18M",
  "fps": 60,
  "encoder": "h264_nvenc",
  "allowKeyboard": false,
  "pinExpiresInMinutes": 10,
  "maxFailedAttempts": 3
}
```

* **`bitrate` / `maxrate`:** `15M`–`20M` is ideal for 5GHz Wi-Fi or Ethernet. For 2.4GHz Wi-Fi, reduce to `6M`–`8M`.
* **`fps`:** Set to `60` for smooth productivity and video playback.
* **`encoder`:** Defaults to `h264_nvenc` for NVIDIA GPUs (falls back to software encoding if NVENC is unavailable).
* **`allowKeyboard`:** Set to `true` only if you explicitly want remote keyboard input enabled.

---

## 🧹 Virtual Monitor Uninstallation

If you wish to remove the virtual display driver:
1. Right-click **[`remove_virtual_monitor.bat`](remove_virtual_monitor.bat)** and choose **Run as Administrator**.
2. The script will delete the virtual device node and deregister the driver cleanly from Windows.

---

## ⚖️ License & Legal Disclaimer

This project is licensed under the **[Apache License 2.0](LICENSE)**.

### Disclaimer of Liability
This software is provided strictly on an **"AS IS"** basis without warranties of any kind. Screen capture, video streaming, hardware drivers, and remote input injection carry inherent operational risks. By using this software, you agree that the authors and contributors bear **zero liability** for any damages, hardware issues, data loss, security incidents, or system instability.

For complete legal terms, warranty disclaimers, and trademark notices, please read **[DISCLAIMER.md](DISCLAIMER.md)**.
