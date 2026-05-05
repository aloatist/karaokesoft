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

Auth + RBAC service (Phase B):

```bash
npm run auth:server
```

Chạy nhanh cả web + relay:

```bash
npm run dev:remote
```

Lệnh này mở Vite ở LAN (`--host 0.0.0.0`) và relay ở `0.0.0.0:8787`, để điện thoại cùng Wi-Fi có thể quét QR và kết nối vào laptop.

Chạy full local (web + relay + auth):

```bash
npm run dev:full
```

Desktop Electron:

```bash
npm run dev:desktop
```

Desktop Electron tự mở relay local `0.0.0.0:8787` nếu chưa có relay chạy sẵn. Renderer local cũng mở trên LAN để link QR có thể dùng IP laptop.

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
- Remote mobile có thể nhập và lưu `Relay URL` thủ công nếu không đi qua QR
- Khi Control chạy bằng `127.0.0.1/localhost`, app sẽ hỏi relay lấy IP LAN của laptop và tự sinh QR/link dạng `http://<IP-laptop>:8787/?screen=remote...` để điện thoại chỉ cần đi qua một cổng relay ổn định.
- Nếu Control báo chưa thấy relay, chạy `npm run dev:remote` thay cho `npm run dev`, hoặc chạy thêm `npm run remote:relay`. Trong modal liên kết có thể nhập IP LAN laptop thủ công rồi quét lại QR.
- Nếu lỡ mở màn hình trình chiếu trên điện thoại, bấm `Chuyển sang điều khiển điện thoại` để đổi từ `display` sang `remote`.
- Giao diện điện thoại chỉ hiện thao tác remote cần thiết; nút mở TV/laptop được ẩn trên màn nhỏ để tránh bấm nhầm.
- Remote điện thoại có nút `Quét QR bằng camera`; khi đọc được QR, app tự lấy `room/token/relay` và kết nối. Android debug đã khai báo quyền `CAMERA`.
- APK Android local dùng `http://localhost` + `android.allowMixedContent=true` + `usesCleartextTraffic=true` để WebView cho phép kết nối relay LAN dạng `ws://IP-laptop:8787`. Production nên chuyển sang `https/wss`.
- Khi deploy production, cần trỏ `VITE_REMOTE_RELAY_URL` về relay server thật hoặc reverse proxy
- Phase B auth API mặc định ở `http://127.0.0.1:8788`
- Dữ liệu auth local lưu ở `server/data/auth-db.json` (đã git ignore)
- Relay có heartbeat cleanup kết nối treo (mặc định 15s, chỉnh bằng `RELAY_HEARTBEAT_INTERVAL_MS`)
- Display tự poll cấu hình quảng cáo từ auth server mỗi 20 giây (fallback về state remote/local nếu auth server không sẵn sàng)

## Cast to TV (Phát lên TV)

Tính năng cho phép điện thoại phát video karaoke trực tiếp lên Smart TV mà không cần laptop.

### Hỗ trợ thiết bị:
- **Chromecast**: Google Chromecast, Android TV, TV có Chromecast built-in
- **Samsung Smart TV**: Tizen OS (qua DLNA/Web App)
- **LG Smart TV**: WebOS (qua DLNA/Web App)
- **Sony/Philips TV**: Android TV (qua Chromecast)

### Cách sử dụng:

1. **Kết nối điện thoại với TV**:
   - Mở app KaraokeYT trên điện thoại
   - Chuyển sang chế độ Remote (`?screen=remote`)
   - Bấm nút "📺 TV" → Chọn TV từ danh sách hoặc nhập IP TV thủ công

2. **Phát video**:
   - Khi đã kết nối TV, video đang phát trên điện thoại sẽ tự động cast lên TV
   - Điều khiển (play/pause/next/volume) vẫn hoạt động qua điện thoại

3. **Ngắt kết nối**:
   - Bấm lại nút "📺 TV" → Chọn "Ngắt kết nối"

### Lưu ý kỹ thuật:

- **Web/PWA**: Chỉ hỗ trợ Chromecast (giới hạn của browser)
- **Android APK**: Hỗ trợ đầy đủ Chromecast + DLNA
- **iOS**: Hỗ trợ AirPlay (thông qua WebView native)
- Điện thoại và TV phải cùng Wi-Fi
- Một số Smart TV yêu cầu bật "Screen Mirroring" hoặc "Cast" trong settings

### Cài đặt plugin (Android):

```bash
npm install @kaikidev/capacitor-plugin-google-cast
npx cap sync android
```

Cấu hình trong `capacitor.config.ts`:
```typescript
plugins: {
  GoogleCast: {
    receiverApplicationId: 'CC1AD845', // Default Media Receiver
  },
}
```

## API Phase B (Auth/RBAC)

- `POST /api/auth/bootstrap-owner` tạo quản trị chính lần đầu.
- `POST /api/auth/login` đăng nhập bằng `username + password/pin`.
- `POST /api/auth/refresh` làm mới phiên.
- `POST /api/auth/logout` đăng xuất.
- `GET /api/auth/csrf` cấp CSRF token cho các request ghi dữ liệu.
- `GET /api/auth/me` lấy thông tin phiên hiện tại.
- `GET/POST/PATCH/DELETE /api/users` quản trị user theo role/capability.
- `GET/PUT /api/config/display-ad` cấu hình quảng cáo trình chiếu (admin).
- `GET /api/audit?limit=...` lấy nhật ký thao tác quản trị.
- Mục `Cài đặt -> Người dùng và phân quyền` đã có khung `Nhật ký quản trị` để theo dõi thay đổi gần nhất.

## Build kiểm tra

```bash
npm run check:preflight
```

Hoặc chạy từng bước:

```bash
npm run lint
npm run build
npm run check:release
npm run check:secrets
```

- `build:web` tu dong sinh `public/version.json` de app kiem tra ban moi (web/PWA).
- `check:preflight` gom `lint + build:web + check:secrets + check:release`, nen chay truoc khi build desktop/APK/AAB.
- `check:runtime` dung sau khi deploy local/staging de test nhanh relay/auth endpoint:

```bash
npm run check:runtime
```

CI:

- Repo da co workflow `.github/workflows/ci.yml` tu chay `lint + build:web + check:release + check:secrets` khi push/PR.

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

Cap nhat khi co phien ban moi:

- Cau hinh `VITE_UPDATE_MANIFEST_URL` tro den file `version.json` public tren server/GitHub Pages/CDN.
- Manifest co the dung mau `public/update-manifest.example.json`, gom `version`, `minimumVersion`, `releaseNotes` va link tai theo nen tang.
- Trong app vao `Cai dat` -> `Cap nhat ung dung` -> `Kiem tra`.
- Desktop ban da dong goi dung them `electron-updater` voi GitHub Release; APK/web se mo link tai tu manifest.

Desktop chay ban chua dong goi:

```bash
npm run build:unpacked
```

Android APK debug:

```bash
npm run build:apk
```

- File APK dung de cai thu nam o `release/KaraokeYT-<version>-debug.apk`
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

## Chrome extension

Extension chuột phải để đưa link YouTube vào hàng chờ nằm ở `extensions/chrome`.

Chạy local:

1. Mở `chrome://extensions`
2. Bật `Developer mode`
3. Chọn `Load unpacked`
4. Chọn thư mục `extensions/chrome`

Mặc định extension ưu tiên gửi bài vào app laptop qua relay `http://127.0.0.1:8787/api/extension/youtube-action`. Nếu app/relay chưa chạy, extension fallback sang `http://127.0.0.1:5173/`. Nếu Control chạy ở URL khác, bấm icon extension -> `Cài đặt` và nhập Control URL.


npm install @capacitor/ios
npx cap add ios
npm run build:web
npx cap sync ios
npx cap open ios
