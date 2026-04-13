#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIGNING_ENV_FILE="$ROOT_DIR/.env.android-signing"
ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

if [[ -z "${JAVA_HOME:-}" && -d "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" ]]; then
  JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
fi

if [[ -f "$SIGNING_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SIGNING_ENV_FILE"
  set +a
fi

for required in ANDROID_UPLOAD_KEYSTORE ANDROID_UPLOAD_STORE_PASSWORD ANDROID_UPLOAD_KEY_ALIAS ANDROID_UPLOAD_KEY_PASSWORD; do
  if [[ -z "${!required:-}" ]]; then
    echo "Thieu $required. Chay: npm run android:generate-keystore" >&2
    exit 1
  fi
done

if [[ ! -f "$ANDROID_UPLOAD_KEYSTORE" ]]; then
  echo "Khong tim thay keystore: $ANDROID_UPLOAD_KEYSTORE" >&2
  exit 1
fi

export ANDROID_HOME
export ANDROID_SDK_ROOT
export JAVA_HOME
export PATH="${JAVA_HOME:+$JAVA_HOME/bin:}$ANDROID_HOME/platform-tools:$PATH"

# Public builds must not bundle the YouTube API key into the client app.
export VITE_YT_API_KEY=""

if [[ -z "${VITE_YOUTUBE_SEARCH_PROXY_URL:-}" ]]; then
  echo "Canh bao: VITE_YOUTUBE_SEARCH_PROXY_URL chua duoc cau hinh. Ban release se khong tim YouTube duoc cho den khi tro ve proxy that." >&2
fi

cd "$ROOT_DIR"
npm run android:sync

cd "$ROOT_DIR/android"
./gradlew bundleRelease

APP_VERSION="$(cd "$ROOT_DIR" && node -p "require('./package.json').version")"
mkdir -p "$ROOT_DIR/release"
cp "$ROOT_DIR/android/app/build/outputs/bundle/release/app-release.aab" "$ROOT_DIR/release/KaraokeYT-$APP_VERSION-release.aab"

echo "AAB release: $ROOT_DIR/release/KaraokeYT-$APP_VERSION-release.aab"
