# KaraokeYT Chrome Extension

Tiện ích thêm menu chuột phải cho link/trang YouTube:

- `Phát ngay`
- `Thêm kế tiếp`
- `Thêm vào danh sách`

## Cài đặt khi phát triển

1. Mở Chrome `chrome://extensions`
2. Bật `Developer mode`
3. Chọn `Load unpacked`
4. Chọn thư mục `extensions/chrome`

## Cấu hình

Mặc định extension ưu tiên gửi bài vào app laptop qua relay local. Extension sẽ tự dò các cổng `8787` và `8790` đến `8799` vì app desktop có thể đổi cổng khi cổng chính đang bận.
Nếu app/relay chưa chạy, extension chỉ gửi vào tab KaraokeYT Control đang mở sẵn trong Chrome. Extension không tự mở tab Control nữa để tránh bài bị thêm nhầm vào trình duyệt thay vì app desktop.

Nếu app chạy ở URL khác:

1. Bấm icon extension
2. Chọn `Cài đặt`
3. Nhập URL màn hình Control của KaraokeYT

Khi app desktop đang mở, extension gửi lệnh qua relay local để bài vào đúng app. Khi chỉ có bản web trong Chrome, extension gửi trực tiếp vào tab KaraokeYT Control đang mở.

## Kiểm tra kết nối

1. Mở app KaraokeYT trên laptop.
2. Bấm icon extension.
3. Bấm `Kiểm tra app`.
4. Nếu thấy `Đã thấy app laptop`, chuột phải video YouTube và chọn `KaraokeYT`.
5. Nếu thấy `Relay chạy nhưng chưa thấy màn hình điều khiển`, hãy mở màn hình điều khiển trong app laptop.
6. Nếu thấy `Relay đang chạy nhưng app laptop là bản cũ`, hãy build/cài lại app desktop rồi restart app.
7. Nếu thấy `Chưa thấy app laptop/relay`, hãy restart app desktop hoặc build lại bản desktop mới nhất.

Sau khi sửa code extension, vào `chrome://extensions` và bấm reload extension. Sau khi sửa app/relay, phải restart hoặc rebuild app desktop đang cài.
