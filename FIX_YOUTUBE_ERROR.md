# 🔧 Fix Lỗi "Chưa cấu hình YouTube Search Proxy hoặc API key"

## ❌ Lỗi Xảy Ra Khi
- Không có `VITE_YOUTUBE_SEARCH_PROXY_URL` trong `.env`
- Không có `VITE_YT_API_KEY` trong `.env`
- Relay server chưa chạy (port 8787)

## ✅ Cách Fix Nhanh (Chọn 1 trong 2)

### Option 1: Dùng Proxy Server (Khuyến nghị)

**Bước 1:** Có file `.env` đúng
```bash
cp .env.example .env
```

**Bước 2:** Thêm YouTube API Key vào `.env`
```env
YOUTUBE_API_KEY=your_server_key
VITE_YOUTUBE_SEARCH_PROXY_URL=http://127.0.0.1:8787/api/youtube/search
```

**Bước 3:** Chạy relay server
```bash
# Terminal 1
node server/remoteRelay.mjs

# Hoặc dùng script
./start-servers.sh
```

**Bước 4:** Chạy app
```bash
# Terminal 2
npm run dev
```

---

### Option 2: Dùng API Key Trực Tiếp (Chỉ cho Dev)

**Bước 1:** Thêm API key vào `.env`
```env
VITE_YT_API_KEY=your_dev_key
```

**Bước 2:** Restart app
```bash
npm run dev
```

⚠️ **Cảnh báo:** Không dùng option này cho production vì API key sẽ bị lộ trong bundle.

---

## 🔍 Kiểm Tra Nhanh

```bash
# 1. Kiểm tra .env file tồn tại
ls -la .env

# 2. Kiểm tra port 8787 (relay server)
curl http://localhost:8787/health

# 3. Kiểm tra biến môi trường
grep VITE_YOUTUBE .env
grep YOUTUBE_API_KEY .env
```

---

## 🎯 Tóm Tắt

| Môi trường | Cách dùng | Lệnh |
|------------|-----------|------|
| **Dev local** | Proxy server + relay | `./start-servers.sh` + `npm run dev` |
| **Dev đơn giản** | API key trực tiếp | Thêm `VITE_YT_API_KEY` vào `.env` |
| **Production** | Proxy server (deploy) | Deploy relay + backend lên server |

---

## 🆘 Vẫn Lỗi?

### Lỗi: "Cannot connect to proxy"
```bash
# Kiểm tra relay chạy chưa
lsof -i :8787

# Nếu chưa, chạy lại
node server/remoteRelay.mjs
```

### Lỗi: "API key invalid"
```bash
# Kiểm tra key đúng không
curl "https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&key=YOUR_KEY"

# Nếu lỗi, tạo key mới tại:
# https://console.cloud.google.com/apis/credentials
```

### Lỗi: "Quota exceeded"
```bash
# YouTube API có giới hạn quota
# Kiểm tra tại: https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
```

---

## 📚 Resources

- Lấy YouTube API Key: https://developers.google.com/youtube/v3/getting-started
- Enable YouTube Data API: https://console.cloud.google.com/apis/library/youtube.googleapis.com
