#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYSTORE_DIR="$ROOT_DIR/android/keystores"
KEYSTORE_PATH="$KEYSTORE_DIR/karaokeyt-upload.jks"
ENV_FILE="$ROOT_DIR/.env.android-signing"
KEY_ALIAS="karaokeyt-upload"

if [[ -z "${JAVA_HOME:-}" && -d "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" ]]; then
  JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
fi

export JAVA_HOME
export PATH="${JAVA_HOME:+$JAVA_HOME/bin:}$PATH"

if [[ -f "$KEYSTORE_PATH" ]]; then
  echo "Keystore da ton tai: $KEYSTORE_PATH"
  echo "Khong ghi de de tranh mat upload key."
  exit 0
fi

mkdir -p "$KEYSTORE_DIR"

STORE_PASSWORD="$(openssl rand -base64 36 | tr -d '\n')"
KEY_PASSWORD="$STORE_PASSWORD"

keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore "$KEYSTORE_PATH" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$STORE_PASSWORD" \
  -keypass "$KEY_PASSWORD" \
  -dname "CN=KaraokeYT, OU=KaraokeYT, O=KaraokeYT, L=Ho Chi Minh, ST=Ho Chi Minh, C=VN"

cat > "$ENV_FILE" <<EOF
ANDROID_UPLOAD_KEYSTORE=$KEYSTORE_PATH
ANDROID_UPLOAD_STORE_PASSWORD=$STORE_PASSWORD
ANDROID_UPLOAD_KEY_ALIAS=$KEY_ALIAS
ANDROID_UPLOAD_KEY_PASSWORD=$KEY_PASSWORD
EOF

chmod 600 "$ENV_FILE"
echo "Da tao upload keystore: $KEYSTORE_PATH"
echo "Da tao bien ky local: $ENV_FILE"
echo "Can backup 2 file nay o noi an toan. Mat upload key se rat kho cap nhat app tren store."
