#!/usr/bin/env python3
"""
AegisDisplay Standalone Python Receiver for Laptops
Streams low-latency H.264 video directly into ffplay with auto-discovery.
"""

import sys
import ssl
import json
import socket
import subprocess

try:
    import websocket
except ImportError:
    print("[Error] 'websocket-client' is required. Install via: pip install websocket-client")
    sys.exit(1)

def discover_host(timeout=2.0):
    """Sends UDP broadcast to discover AegisDisplay Host PC automatically."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    s.settimeout(timeout)
    try:
        s.sendto(b"AEGIS_DISCOVER", ("255.255.255.255", 8444))
        data, _ = s.recvfrom(1024)
        info = json.loads(data.decode())
        if info.get("type") == "AEGIS_ANNOUNCE":
            return info.get("ip"), info.get("port", 8443), info.get("host", "Host PC")
    except Exception:
        pass
    finally:
        s.close()
    return None, None, None

def main():
    print("=" * 55)
    print("    AegisDisplay - Standalone Native Laptop Client   ")
    print("=" * 55)

    print("\n🔍 Auto-detecting Host PC on local network...")
    disc_ip, disc_port, disc_host = discover_host(timeout=2.0)

    if disc_ip:
        print(f"🟢 Auto-detected: {disc_host} ({disc_ip}:{disc_port})")
        host_ip = disc_ip
        port = str(disc_port)
    else:
        print("⚠️  No broadcast received. Falling back to manual IP entry.")
        host_ip = input("Enter Host PC IP [192.168.10.3]: ").strip() or "192.168.10.3"
        port = input("Enter Port [8443]: ").strip() or "8443"

    pin = input("\nEnter 6-digit Host PIN: ").strip()

    ws_url = f"wss://{host_ip}:{port}/ws"
    print(f"\n[Connecting] Establishing encrypted TLS connection to {ws_url}...")

    # Allow local self-signed TLS certificates
    ssl_opt = {"cert_reqs": ssl.CERT_NONE, "check_hostname": False}

    try:
        ws = websocket.create_connection(ws_url, sslopt=ssl_opt)
    except Exception as e:
        print(f"[Error] Failed to connect: {e}")
        return

    # Authenticate
    ws.send(json.dumps({
        "type": "auth",
        "pin": pin,
        "userAgent": "AegisDisplay-NativeLaptopClient/1.0"
    }))

    resp = json.loads(ws.recv())
    if resp.get("type") != "auth_success":
        print(f"[Auth Error] {resp.get('error', 'Authentication failed')}")
        ws.close()
        return

    token = resp["token"]
    print("[Auth] Paired successfully with Host PC.")

    # Request displays
    ws.send(json.dumps({
        "type": "get_displays",
        "token": token
    }))

    resp = json.loads(ws.recv())
    displays = resp.get("displays", [])
    if not displays:
        print("[Error] No displays returned by host.")
        ws.close()
        return

    # Auto-detect extended display
    target_display = next((d for d in displays if not d.get("isPrimary")), displays[0])
    display_id = target_display["id"]
    print(f"🖥️  Auto-selected: {target_display['name']} ({target_display['width']}x{target_display['height']})")

    # Launch ffplay in low-latency pipeline
    ffplay_cmd = [
        "ffplay",
        "-hide_banner",
        "-loglevel", "error",
        "-window_title", f"AegisDisplay - Extended Monitor {display_id}",
        "-flags", "low_delay",
        "-fflags", "nobuffer",
        "-probesize", "32",
        "-analyzeduration", "0",
        "-framedrop",
        "-sync", "video",
        "-f", "h264",
        "-i", "-"
    ]

    try:
        ffplay_proc = subprocess.Popen(ffplay_cmd, stdin=subprocess.PIPE)
    except FileNotFoundError:
        print("\n[Notice] 'ffplay' was not found on your laptop PATH.")
        print("Tip: You can use Option 1 in launch_laptop.bat to stream in borderless App Window without installing FFmpeg!")
        ws.close()
        return

    # Subscribe to display stream
    ws.send(json.dumps({
        "type": "select_display",
        "token": token,
        "displayId": display_id
    }))

    print(f"\n[Streaming] Video stream active for Display {display_id} in ffplay. Press Ctrl+C to stop.\n")

    try:
        while True:
            if ffplay_proc.poll() is not None:
                print("\n[Player] ffplay window closed.")
                break
            chunk = ws.recv()
            if isinstance(chunk, bytes):
                try:
                    ffplay_proc.stdin.write(chunk)
                    ffplay_proc.stdin.flush()
                except (BrokenPipeError, OSError):
                    break
    except (KeyboardInterrupt, websocket.WebSocketConnectionClosedException):
        print("\n[Disconnecting] Exiting stream...")
    finally:
        ws.close()
        if ffplay_proc and ffplay_proc.poll() is None:
            try:
                ffplay_proc.terminate()
            except Exception:
                pass

if __name__ == "__main__":
    main()
