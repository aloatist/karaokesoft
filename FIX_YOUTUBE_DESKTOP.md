# Fix Lỗi YouTube Search Trên Desktop App

## Vấn Đề

Desktop app (Electron) báo lỗi:
```
"Chưa cấu hình YouTube Search Proxy hoặc API key trong môi trường chạy ứng dụng."
```

## Nguyên Nhân

Desktop app tự động chạy embedded relay server trên localhost:8787, nhưng relay server cần `YOUTUBE_API_KEY` để tìm kiếm YouTube. Web app không bị lỗi vì dùng proxy URL đã cấu hình.

## Các Giải Pháp

### Cách 1: Rebuild với YouTube API Key (Khuyến nghị)

1. **Lấy YouTube API Key**:
   - Vào https://console.cloud.google.com/apis/credentials
   - Tạo API Key mới
   - Bật "YouTube Data API v3" cho key này

2. **Rebuild app**:
   ```bash
   # Trên macOS
   YOUTUBE_API_KEY=your_key scripts/build-desktop-with-apikey.sh mac
   
   # Trên Windows (dùng Git Bash)
   YOUTUBE_API_KEY=your_key scripts/build-desktop-with-apikey.sh win
   
   # Trên Linux
   YOUTUBE_API_KEY=your_key scripts/build-desktop-with-apikey.sh linux
   ```

3. **Cài đặt file mới** từ `release/`

### Cách 2: Dùng External Proxy (Không cần rebuild)

Nếu đã có server/proxy chạy sẵn với API key:

1. Tạo file `.env` trong thư mục app:
   ```
   VITE_YOUTUBE_SEARCH_PROXY_URL=http://your-server.com/api/youtube/search
   ```

2. Hoặc set environment variable trước khi chạy app:
   ```bash
   # macOS/Linux
   export VITE_YOUTUBE_SEARCH_PROXY_URL=http://your-server.com/api/youtube/search
   open KaraokeYT.app
   
   # Windows
   set VITE_YOUTUBE_SEARCH_PROXY_URL=http://your-server.com/api/youtube/search
   KaraokeYT.exe
   ```

### Cách 3: Chạy Relay Server Riêng (Dev mode)

1. Chạy relay server với API key:
   ```bash
   YOUTUBE_API_KEY=your_key npm run relay
   ```

2. Mở desktop app → App sẽ tự động kết nối relay server localhost:8787

## Kiểm Tra

Sau khi fix, mở app và thử tìm kiếm YouTube. Nếu thành công sẽ hiện danh sách bài hát.

## Lưu Ý Bảo Mật

- **API key trong desktop app** có thể bị extract từ binary (accept risk)
- **API key trong relay server** an toàn hơn nếu server do bạn control
- **Rate limit**: YouTube API có quota 100 requests/ngày cho free tier

## Tự Động Build CI/CD

Để CI tự động build với API key, set secret trong GitHub:

1. Repo → Settings → Secrets → New repository secret
2. Name: `YOUTUBE_API_KEY`
3. Value: API key của bạn
4. Push tag để trigger build:
   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```

---

*Cập nhật: 2026-04-16*
