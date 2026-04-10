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
