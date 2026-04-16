# Cài Đặt YouTube API Key Cho Desktop App

## Bước 1: Lấy YouTube API Key

1. Vào https://console.cloud.google.com/apis/credentials
2. Tạo **API Key** mới
3. Bật **YouTube Data API v3** cho key này
4. Copy key (dạng `AIza...`)

## Bước 2: Tạo File Config

### macOS

**Cách A: Trong app bundle (khuyến nghị)**
```bash
# Sau khi cài KaraokeYT.app
sudo nano /Applications/KaraokeYT.app/Contents/Resources/karaokeyt-config.json
```

Nội dung:
```json
{
  "YOUTUBE_API_KEY": "YOUR_ACTUAL_API_KEY"
}
```

**Cách B: Trong userData**
```bash
mkdir -p ~/Library/Application\ Support/KaraokeYT
echo '{"YOUTUBE_API_KEY": "YOUR_KEY"}' > ~/Library/Application\ Support/KaraokeYT/karaokeyt-config.json
```

### Windows

Tạo file `karaokeyt-config.json` trong cùng thư mục với `KaraokeYT.exe`:
```
C:\Program Files\KaraokeYT\karaokeyt-config.json
```

Hoặc trong userData:
```
%APPDATA%\KaraokeYT\karaokeyt-config.json
```

### Linux

```bash
# Cùng thư mục với AppImage/binary
nano /path/to/karaokeyt-config.json

# Hoặc trong userData
mkdir -p ~/.config/KaraokeYT
echo '{"YOUTUBE_API_KEY": "YOUR_KEY"}' > ~/.config/KaraokeYT/karaokeyt-config.json
```

## Bước 3: Restart App

Đóng và mở lại KaraokeYT → YouTube search sẽ hoạt động!

---

## Kiểm Tra

Mở Terminal/Console và chạy app với debug:
```bash
# macOS
/Applications/KaraokeYT.app/Contents/MacOS/KaraokeYT

# Tìm log: "Đã đọc YOUTUBE_API_KEY từ: ..."
```

## Lưu Ý Bảo Mật

- File config là **local** → không bị push lên Git
- API key chỉ dùng trên máy của bạn → quota riêng
- Không share config.json chứa API key thật

---

## Troubleshooting

| Lỗi | Giải Pháp |
|-----|-----------|
| "Đã đọc YOUTUBE_API_KEY" không hiện | Kiểm tra đường dẫn file config |
| "API_QUOTA_EXCEEDED" | YouTube API quota hết, chờ 24h hoặc upgrade |
| "Không mở được relay" | Kiểm tra port 8787 có bị chiếm không |

---

*Cập nhật: 2026-04-16*
