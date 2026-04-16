#!/bin/bash
# Build desktop app with YouTube API key
# Usage: YOUTUBE_API_KEY=your_key scripts/build-desktop-with-apikey.sh [mac|win|linux]

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLATFORM="${1:-mac}"

if [[ -z "${YOUTUBE_API_KEY:-}" ]]; then
    echo "Error: YOUTUBE_API_KEY chưa được set."
    echo "Usage: YOUTUBE_API_KEY=your_key scripts/build-desktop-with-apikey.sh [mac|win|linux]"
    echo ""
    echo "Lấy API key từ: https://console.cloud.google.com/apis/credentials"
    exit 1
fi

echo "=== Building KaraokeYT Desktop với YouTube API ==="
echo "Platform: $PLATFORM"
echo ""

cd "$ROOT_DIR"

# Export env cho electron-builder
export YOUTUBE_API_KEY
export VITE_YOUTUBE_SEARCH_PROXY_URL="http://localhost:8787/api/youtube/search"

# Pre-build checks
echo "→ Kiểm tra môi trường..."
npm run lint

# Build web
echo "→ Building web bundle..."
npm run build:web

# Build desktop
echo "→ Building desktop app ($PLATFORM)..."
case "$PLATFORM" in
    mac)
        npm run build:mac
        ;;
    win)
        npm run build:win
        ;;
    linux)
        npm run build:linux
        ;;
    *)
        echo "Platform không hợp lệ: $PLATFORM"
        echo "Chọn: mac, win, hoặc linux"
        exit 1
        ;;
esac

echo ""
echo "=== Build thành công! ==="
echo "Output: $ROOT_DIR/release/"
echo ""
echo "File đã build:"
ls -lh "$ROOT_DIR/release/"*.{dmg,exe,AppImage,zip} 2>/dev/null || true
