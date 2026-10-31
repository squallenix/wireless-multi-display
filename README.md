# AegisDisplay: Secure, Ultra-Low Latency Wireless Multi-Display System

Turn any laptop, smartphone, or tablet on your local network (Wi-Fi or LAN) into a high-performance 2nd, 3rd, or 4th monitor for your Windows PC, with physical-cable-like responsiveness (~8–15 ms latency) and enterprise-grade security.

---

## Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                                 HOST PC (Windows)                                 |
|                                                                                   |
|  [ Virtual Display Driver (IddCx) ] ---> Creates Monitor #2, #3 in Windows        |
|                  |                                                                |
|                  v                                                                |
|  [ DXGI Desktop Duplication API ]  ---> Zero-copy GPU frame capture (< 1 ms)      |
|                  |                                                                |
|                  v                                                                |
|  [ NVIDIA NVENC (RTX 5060) ]       ---> H.264/HEVC Ultra-Low Latency (p1/ull/CBR) |
|                  |                                                                |
|                  v                                                                |
|  [ TLS / HTTPS & Secure WSS ]      ---> Encrypted transport with 6-digit PIN auth  |
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
|  [ GPU <canvas> Viewport ]         ---> Fullscreen native display feel            |
|                  |                                                                |
|                  v                                                                |
|  [ Sandboxed Input Backchannel ]   ---> Mouse & Touch clamped to monitor bounds   |
+-----------------------------------------------------------------------------------+
```

---

## 🔒 Security Architecture (Anti-Hacker Hardening)

Wireless screen sharing and remote input are high-risk vectors if left unprotected. AegisDisplay enforces **Zero-Trust Security**:

1. **Mandatory End-to-End Encryption (TLS / HTTPS & WSS)**
   - All network traffic, video streams, and input events are encrypted using TLS with 2048-bit RSA keys.
   - Self-signed certificates are automatically generated locally on first launch.
   - Plain HTTP and unencrypted WebSockets are completely rejected.

2. **Cryptographic Device Pairing (One-Time PIN)**
   - When a device connects, it must enter the 6-digit random PIN displayed only on the host PC's screen.
   - The PIN rotates automatically upon successful pairing and expires after 10 minutes.
   - Verification uses constant-time string comparison (`crypto.timingSafeEqual`) to eliminate side-channel timing attacks.

3. **Brute-Force & Rate-Limiting Protection**
   - Maximum **3 failed PIN attempts** per IP address.
   - Exceeding 3 failed attempts triggers an automatic **5-minute IP lockout**.
   - Prevents unauthorized devices on the local network from brute-forcing access.

4. **Input Sandboxing & Coordinate Clamping (Anti-Remote Hijack)**
   - Touch and mouse events received from a client device are **strictly clamped** to the exact pixel rectangle (`[left, top, right, bottom]`) of the assigned virtual monitor.
   - A client viewing Monitor 2 **CANNOT** move the mouse cursor or click onto Monitor 1 (primary desktop) or the Windows taskbar.
   - Keyboard keystroke injection is **disabled by default** to prevent malicious command execution.

5. **Anti-CSWSH & DNS Rebinding Protection**
   - Strict `Origin` and `Host` validation on WebSocket handshakes prevents malicious websites visited by the user from hijacking the streaming session.

---

## 🚀 Performance Highlights

- **GPU Acceleration:** Encodes via **NVIDIA NVENC** (RTX 5060) with `preset=p1` (ultra-fast) and `tune=ull` (ultra-low latency).
- **Zero B-Frames:** `bf=0` eliminates frame buffering latency.
- **Client Hardware Decoding:** Uses the modern **WebCodecs API** directly in the browser on laptops and phones, achieving 1–3 ms decode times.
- **Zero Client Install:** Any client device with a modern browser (Chrome, Edge, Safari, Opera) connects via URL without installing third-party apps.

---

## 🛠️ Quick Start

### 1. Launch the Server on Host PC
Double-click `start.bat` or run in PowerShell:
```powershell
npm start
```

The host terminal will display:
```
======================================================
🛡️  AEGISDISPLAY - SECURE WIRELESS MULTI-DISPLAY HOST
======================================================
Host GPU: NVIDIA GeForce RTX 5060 (NVENC Low-Latency)
Status: Operational & Listening on port 8443

Connect your laptop or phone on the same network to:
   👉 https://192.168.10.3:8443
   👉 https://localhost:8443

======================================================
[AUTH] NEW PAIRING PIN GENERATED: >>> 849201 <<<
======================================================
```

### 2. Connect Your Laptop / Phone
1. Open Chrome, Edge, or Safari on your laptop, phone, or tablet.
2. Navigate to: `https://<YOUR-PC-IP>:8443` (e.g. `https://192.168.10.3:8443`).
3. Accept the self-signed certificate warning (first time only).
4. Enter the **6-Digit PIN** shown in the host console.
5. Select which display you wish to use.
6. Click **⛶ Fullscreen** to make your laptop/phone look exactly like a physical cable-connected monitor!

---

## 🖥️ How to Add 2nd and 3rd Virtual Displays (Without Cables)

Windows requires an Indirect Display Driver to create extended desktop monitors without physical cables or dummy plugs.

To enable virtual displays:
1. Run the setup helper:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\setup_virtual_display.ps1
   ```
2. Download the signed open-source driver from [Virtual-Display-Driver Releases](https://github.com/itsmikethetech/Virtual-Display-Driver/releases).
3. Extract and run `device-installer.bat` as Administrator.
4. Open **Windows Settings > System > Display**.
5. You will now see **Monitor 2** (and Monitor 3) as real extended displays that you can arrange, resize, or set custom resolutions for (1080p, 1440p, 60Hz, 120Hz).
6. AegisDisplay will instantly detect the new monitor, allowing your laptop or phone to bind directly to it!

---

## ⚙️ Configuration (`config.json`)

You can tune performance in `config.json`:
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

- For **5GHz / 6GHz Wi-Fi or Ethernet**, `15M` to `20M` bitrate provides crisp, cable-quality text.
- For slower 2.4GHz Wi-Fi, reduce `"bitrate": "8M"`.
