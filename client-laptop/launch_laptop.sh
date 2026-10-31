#!/usr/bin/env bash
# AegisDisplay - Laptop Client Launcher for macOS & Linux

echo "======================================================"
echo "      AegisDisplay: Laptop Receiver App Launcher      "
echo "======================================================"
echo ""

read -p "Enter your Host PC IP [default: 192.168.10.3]: " HOST_IP
HOST_IP=${HOST_IP:-192.168.10.3}

read -p "Enter Port [default: 8443]: " PORT
PORT=${PORT:-8443}

TARGET_URL="https://${HOST_IP}:${PORT}/"

echo "Launching standalone receiver window for ${TARGET_URL}..."

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if [ -d "/Applications/Google Chrome.app" ]; then
        open -na "Google Chrome" --args --app="${TARGET_URL}" --start-fullscreen --ignore-certificate-errors --allow-insecure-localhost
    elif [ -d "/Applications/Microsoft Edge.app" ]; then
        open -na "Microsoft Edge" --args --app="${TARGET_URL}" --start-fullscreen --ignore-certificate-errors --allow-insecure-localhost
    else
        open "${TARGET_URL}"
    fi
else
    # Linux
    FLAGS="--app=${TARGET_URL} --start-fullscreen --ignore-certificate-errors --allow-insecure-localhost --unsafely-treat-insecure-origin-as-secure=https://${HOST_IP}:${PORT}"
    if command -v google-chrome &> /dev/null; then
        google-chrome $FLAGS &
    elif command -v chromium-browser &> /dev/null; then
        chromium-browser $FLAGS &
    elif command -v microsoft-edge &> /dev/null; then
        microsoft-edge $FLAGS &
    else
        xdg-open "${TARGET_URL}" &
    fi
fi
