#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

if [[ -z "${JAVA_HOME:-}" && -d "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" ]]; then
  JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
fi

export ANDROID_HOME
export ANDROID_SDK_ROOT
export JAVA_HOME
export PATH="${JAVA_HOME:+$JAVA_HOME/bin:}$ANDROID_HOME/platform-tools:$PATH"

cd "$ROOT_DIR"
npm run android:sync

cd "$ROOT_DIR/android"
./gradlew assembleDebug

mkdir -p "$ROOT_DIR/release"
cp "$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk" "$ROOT_DIR/release/KaraokeYT-0.1.0-debug.apk"

echo "APK debug: $ROOT_DIR/release/KaraokeYT-0.1.0-debug.apk"
