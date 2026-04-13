# karaokesoft

Ứng dụng karaoke gồm 3 vai trò:

- `Control`: màn hình điều khiển chính
- `Display`: màn hình trình chiếu ra TV / màn phụ
- `Remote`: điện thoại điều khiển host bằng mã phòng

## Chạy local

Web control:

```bash
npm install
npm run dev
```

Remote relay cho điện thoại:

```bash
npm run remote:relay
```

Chạy nhanh cả web + relay:

```bash
npm run dev:remote
```

Desktop Electron:

```bash
npm run dev:desktop
```

## Mobile Remote MVP

Luồng hiện tại:

1. Mở `Control`
2. Bấm nút `Điện thoại`
3. Quét `QR pairing` hoặc lấy `mã phòng` / `link remote`
4. Điện thoại mở `?screen=remote&room=XXXXXX`
5. Điện thoại điều khiển `phát / tạm dừng / tiếp theo / từ đầu / âm lượng / hàng chờ`

Lưu ý:

- Bản hiện tại **không bắt buộc đăng nhập**
- Remote đang dùng `WebSocket relay`
- Local dev mặc định relay ở `ws://127.0.0.1:8787`
- Khi deploy production, cần trỏ `VITE_REMOTE_RELAY_URL` về relay server thật hoặc reverse proxy

## Build kiểm tra

```bash
npm run lint
npm run build
```

## Dong goi thanh app

Web va mobile web app:

```bash
npm run build
```

- Thu muc build web nam o `dist/`
- Android co the mo web app va chon `Add to Home Screen`
- iPhone co the mo Safari va chon `Add to Home Screen`
- Ban nay da co `manifest.webmanifest` va `service worker` de cai nhu app

Desktop installer:

```bash
npm run build:mac
npm run build:win
npm run build:linux
```

- File dong goi se nam o `release/`
- Tren may mac hien tai, co the build truc tiep `build:mac`
- `build:win` nen chay tren Windows hoac CI Windows
- `build:linux` nen chay tren Linux hoac CI Linux

Desktop chay ban chua dong goi:

```bash
npm run build:unpacked
```

Android APK debug:

```bash
npm run build:apk
```

- File APK dung de cai thu nam o `release/KaraokeYT-0.1.0-debug.apk`
- Ban debug dung de test noi bo, chua phai ban ky release de dua len Google Play
- Neu may chua co Android SDK, script macOS se uu tien JDK Homebrew o `/opt/homebrew/opt/openjdk@21`

Android release AAB cho Google Play:

```bash
npm run android:generate-keystore
npm run build:aab
```

- File AAB nam o `release/KaraokeYT-0.1.0-release.aab`
- Upload key local nam o `android/keystores/karaokeyt-upload.jks`
- Bien ky local nam o `.env.android-signing`
- Hai file tren da duoc git ignore. Can backup rieng, khong dua len repo cong khai
- Ban release tu dong xoa `VITE_YT_API_KEY` khoi bundle client. Truoc khi public, cau hinh `VITE_YOUTUBE_SEARCH_PROXY_URL` tro ve proxy that

YouTube search proxy:

```bash
YOUTUBE_API_KEY=your_server_key npm run remote:relay
```

Endpoint proxy mac dinh:

```text
http://127.0.0.1:8787/api/youtube/search
```

Khi deploy production, dat:

```bash
VITE_YOUTUBE_SEARCH_PROXY_URL=https://your-domain.com/api/youtube/search
```
