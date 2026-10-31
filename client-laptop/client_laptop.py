#!/usr/bin/env python3
"""
AegisDisplay Standalone Python Receiver for Laptops
Streams low-latency H.264 video directly into ffplay with zero latency.
"""

import sys
import ssl
import json
import subprocess
import getpass

try:
    import websocket
except ImportError:
    print("[Error] 'websocket-client' is required. Install via: pip install websocket-client")
    sys.exit(1)

def main():
    print("=" * 55)
    print("    AegisDisplay - Standalone Native Laptop Client   ")
    print("=" * 55)

    host_ip = input("Enter Host PC IP [192.168.10.3]: ").strip() or "192.168.10.3"
    port = input("Enter Port [8443]: ").strip() or "8443"
    pin = input("Enter 6-digit Host PIN: ").strip()

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

    print("\nAvailable Displays on Host:")
    for d in displays:
        tag = "[Primary]" if d.get("isPrimary") else "[Extended]"
        print(f"  [{d['id']}] {d['name']} {tag} - {d['width']}x{d['height']}")

    choice = input("\nSelect Display ID [default 0]: ").strip() or "0"
    display_id = int(choice)

    # Launch ffplay in low-latency pipeline
    ffplay_cmd = [
        "ffplay",
        "-hide_banner",
        "-loglevel", "error",
        "-window_title", f"AegisDisplay - Monitor {display_id}",
        "-flags", "low_delay",
        "-fflags", "nobuffer",
        "-probesize", "32",
        "-analyzeduration", "0",
        "-framedrop",
        "-sync", "ext",
        "-f", "h264",
        "-i", "-"
    ]

    try:
        ffplay_proc = subprocess.Popen(ffplay_cmd, stdin=subprocess.PIPE)
    except FileNotFoundError:
        print("[Error] 'ffplay' not found. Please install FFmpeg on your laptop.")
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
            chunk = ws.recv()
            if isinstance(chunk, bytes):
                ffplay_proc.stdin.write(chunk)
                ffplay_proc.stdin.flush()
    except (KeyboardInterrupt, websocket.WebSocketConnectionClosedException):
        print("\n[Disconnecting] Exiting stream...")
    finally:
        ws.close()
        if ffplay_proc:
            ffplay_proc.terminate()

if __name__ == "__main__":
    main()
