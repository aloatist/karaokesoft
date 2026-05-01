# Hướng Dẫn Build & Release KaraokeYT

## 📦 Build Hiện Tại (Local)

### ✅ macOS (Apple Silicon)
Đã build xong:
- `release/KaraokeYT-0.1.0-mac-arm64.dmg` (119 MB)
- `release/KaraokeYT-0.1.0-mac-arm64.zip` (115 MB)

### ✅ Android
Đã build xong:
- `release/KaraokeYT-0.1.0-debug.apk` (4.3 MB) - Có thể cài trực tiếp
- `release/KaraokeYT-0.1.0-release.aab` (3.1 MB) - Upload Google Play

---

## 🪟 Build Windows & Linux (CI/CD)

### Cách 1: GitHub Actions (Khuyến nghị)

1. **Push tag** để tự động build tất cả platforms:
   ```bash
   git add .
   git commit -m "Release v0.1.0 - Cast to TV feature"
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. **Vào GitHub** → Actions → "Build Desktop Apps" → Download artifacts

3. **Hoặc trigger thủ công**:
   - GitHub → Actions → Build Desktop Apps → Run workflow

### Desktop Auto Update

Desktop Windows/mac/Linux dùng `electron-updater` qua GitHub Release. Khi có tag mới, workflow `Build Desktop Apps` sẽ build và upload các file cần thiết lên Release:

- Windows: `.exe`, `.blockmap`, `latest.yml`
- macOS: `.dmg`, `.zip`, `.blockmap`, `latest-mac.yml`
- Linux: `.AppImage`/`.deb`, `.yml`

Quy trình phát hành bản mới:

```bash
npm version patch
git push origin main
git push origin v$(node -p "require('./package.json').version")
```

Sau khi GitHub Actions chạy xong, người dùng mở app sẽ thấy banner cập nhật. Bấm `Cập nhật`, chờ tải xong, rồi bấm `Khởi động lại để cập nhật`. Người dùng không cần tải lại bộ cài thủ công.

Lưu ý:

- Auto update chỉ chạy khi app đã được đóng gói (`app.isPackaged`), không chạy trong `npm run dev:desktop`.
- GitHub Release phải có `latest.yml` và file `.exe/.blockmap` tương ứng cho Windows.
- Windows auto update chỉ nên dùng bản cài đặt `setup.exe`. Bản `portable.exe` là bản chạy nhanh để test, không phải luồng cập nhật chính.
- macOS production cần code signing/notarization để cập nhật ổn định trên máy người dùng ngoài môi trường test.
- Android/iOS không thể tự cài APK/AAB kiểu desktop; production nên dùng Google Play/App Store hoặc link tải APK trong manifest.

### Cách 2: Docker (Build Linux local)

```bash
docker run --rm -v $(pwd):/app -w /app \
  -e ELECTRON_CACHE=/root/.cache/electron \
  -e ELECTRON_BUILDER_CACHE=/root/.cache/electron-builder \
  electronuserland/builder \
  bash -c "npm ci && npm run build:linux"
```

---

## 📱 Cài Đặt APK trên Android

### Cách 1: ADB (Developer)
```bash
adb install release/KaraokeYT-0.1.0-debug.apk
```

### Cách 2: Chuyển file trực tiếp
1. Copy APK vào điện thoại
2. Mở file → Cài đặt
3. Cho phép "Unknown sources" nếu cần

### Cách 3: Google Play (Production)
Upload `release/KaraokeYT-0.1.0-release.aab` lên Google Play Console

---

## 🖥️ Cài Đặt Desktop

### macOS
1. Mở `KaraokeYT-0.1.0-mac-arm64.dmg`
2. Kéo KaraokeYT vào Applications
3. Mở từ Applications (bỏ qua cảnh báo Gatekeeper nếu có)

### iPhone chạy local từ Mac
1. Bật `Developer Mode` trên iPhone.
2. Đăng nhập Apple ID trong Xcode và chọn `Team` cho target `App`.
3. Cắm iPhone, mở khóa máy, chấp nhận `Trust This Computer`.
4. Chạy:
   ```bash
   npm run ios:run -- 00008110-00121C641A9B801E
   ```
5. Nếu không truyền UDID, script sẽ tự chọn iPhone đang kết nối đầu tiên.

Ghi chú:
- Script `ios:run` không dùng `cap run ios` nữa. Nó build bằng `xcodebuild`, cài bằng `devicectl`, rồi retry launch để tránh lỗi `ERR_UNKNOWN` sau bước cài.
- Nếu iPhone chưa cho mở app sau lần cài đầu, mở tay biểu tượng app một lần để xác nhận developer app.

### Windows (Từ CI)
1. Download `KaraokeYT-0.1.0-win-x64.exe` từ GitHub Actions
2. Chạy file .exe để cài đặt

### Linux (Từ CI)
1. Download `KaraokeYT-0.1.0-linux-x86_64.AppImage` hoặc `.deb`
2. Chạy AppImage: `chmod +x *.AppImage && ./*.AppImage`

---

## 🔄 Tính Năng Cast to TV - Test Guide

### Web (Chrome/Edge)
1. Mở http://localhost:5173/?screen=control
2. Bấm "Liên kết TV và điện thoại"
3. Quét QR bằng điện thoại
4. Bấm nút "📺 TV" để cast

### Android APK
1. Cài APK lên điện thoại
2. Mở app, chọn "Remote"
3. Quét QR hoặc nhập IP laptop
4. Bấm nút "📺 TV" → Chọn Chromecast/Smart TV

### Desktop (macOS/Windows/Linux)
1. Chạy app
2. Relay server tự động chạy embedded
3. Dùng điện thoại remote qua QR

---

## 🚀 Checklist Release

- [ ] Build và test local
- [ ] Push tag v* để CI build
- [ ] Download và test Windows/Linux artifacts
- [ ] Test Android APK trên thiệt bị thật
- [ ] Test Cast to TV với Chromecast
- [ ] Upload AAB lên Google Play (nếu release)
- [ ] Tạo GitHub Release với notes

---

## 📁 Artifacts CI/CD

| Platform | Output | Vị trí |
|----------|--------|--------|
| macOS | `.dmg`, `.zip` | GitHub Actions Artifacts |
| Windows | `.exe`, `.msi` | GitHub Actions Artifacts |
| Linux | `.AppImage`, `.deb` | GitHub Actions Artifacts |
| Android | `.apk`, `.aab` | GitHub Actions Artifacts |

---

*Cập nhật: 2026-04-16*
