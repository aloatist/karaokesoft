#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DEVICE="${1:-${IOS_TARGET_DEVICE:-}}"
DERIVED_DATA_PATH="$ROOT_DIR/ios/DerivedData"
XCODE_PROJECT="$ROOT_DIR/ios/App/App.xcodeproj"
XCODE_SCHEME="App"
APP_BUNDLE_PATH="$DERIVED_DATA_PATH/Build/Products/Debug-iphoneos/App.app"

if [[ -z "$TARGET_DEVICE" ]]; then
  TARGET_DEVICE="$(xcrun devicectl list devices 2>/dev/null | awk 'NR>2 && $4 == "connected" { print $1; exit }')"
fi

if [[ -z "$TARGET_DEVICE" ]]; then
  echo "Khong tim thay iPhone dang ket noi. Hay cam cap va mo khoa may." >&2
  exit 1
fi

cd "$ROOT_DIR"
npm run ios:sync

xcodebuild \
  -project "$XCODE_PROJECT" \
  -scheme "$XCODE_SCHEME" \
  -destination "id=$TARGET_DEVICE" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  build

if [[ ! -d "$APP_BUNDLE_PATH" ]]; then
  echo "Khong tim thay App.app sau khi build: $APP_BUNDLE_PATH" >&2
  exit 1
fi

BUNDLE_ID="$(plutil -extract CFBundleIdentifier raw -o - "$APP_BUNDLE_PATH/Info.plist")"
INSTALL_LOG="$(mktemp)"
LAUNCH_LOG="$(mktemp)"
cleanup() {
  rm -f "$INSTALL_LOG" "$LAUNCH_LOG"
}
trap cleanup EXIT

xcrun devicectl device install app --device "$TARGET_DEVICE" "$APP_BUNDLE_PATH" >"$INSTALL_LOG"
cat "$INSTALL_LOG"

APP_INSTALL_URL="$(sed -n 's/^• installationURL: file:\/\//\//p' "$INSTALL_LOG" | tail -n 1 | tr -d '\r')"
if [[ -n "$APP_INSTALL_URL" ]]; then
  APP_INSTALL_URL="${APP_INSTALL_URL%/}"
fi

for attempt in 1 2 3; do
  if xcrun devicectl device process launch --device "$TARGET_DEVICE" "$BUNDLE_ID" >"$LAUNCH_LOG" 2>&1; then
    cat "$LAUNCH_LOG"
    exit 0
  fi
  sleep 2
done

if [[ -n "$APP_INSTALL_URL" ]]; then
  if xcrun devicectl device process launch --device "$TARGET_DEVICE" "$APP_INSTALL_URL" >"$LAUNCH_LOG" 2>&1; then
    cat "$LAUNCH_LOG"
    exit 0
  fi
fi

cat "$LAUNCH_LOG" >&2
echo "Khong mo duoc app tren iPhone. Kiem tra lai Trusted Developer App va thu mo app tay tren may." >&2
exit 1
