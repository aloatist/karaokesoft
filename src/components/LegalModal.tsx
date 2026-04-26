type Props = {
  open: boolean
  onClose: () => void
}

export function LegalModal({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Pháp lý và quyền riêng tư">
      <div className="modal legalModal">
        <div className="modalHeader">
          <div className="modalTitle">Pháp lý và quyền riêng tư</div>
          <button className="ghost" onClick={onClose} type="button">
            Đóng
          </button>
        </div>

        <div className="modalBody legalBody">
          <section className="legalSection">
            <div className="legalEyebrow">Quyền riêng tư</div>
            <h2>Ứng dụng ưu tiên dùng nhanh, không bắt buộc đăng nhập</h2>
            <p>
              KaraokeYT lưu hàng chờ, cấu hình giao diện, mã TV và user cục bộ trên thiết bị để phục vụ thao tác karaoke.
              Nếu bạn dùng tài khoản tuỳ chọn hiện tại, thông tin này vẫn là dữ liệu nội bộ của ứng dụng, chưa phải tài khoản
              cloud công khai.
            </p>
            <p>
              Khi tìm bài, từ khoá tìm kiếm có thể được gửi tới máy chủ proxy của KaraokeYT hoặc YouTube Data API để lấy kết
              quả video. Nếu bạn dùng desktop app, có thể nhập YouTube API key trong phần Cài đặt; key chỉ được lưu cục bộ trên laptop đó.
            </p>
          </section>

          <section className="legalSection">
            <div className="legalEyebrow">YouTube</div>
            <h2>Nội dung và quảng cáo thuộc YouTube</h2>
            <p>
              Video được phát qua YouTube embedded player. Một số video có thể có quảng cáo, bị chặn phát nhúng, bị xoá, bị
              chuyển riêng tư hoặc yêu cầu xem trực tiếp trên YouTube. Ứng dụng không chặn, sửa hoặc tự động bỏ qua quảng cáo
              YouTube.
            </p>
            <p>
              Nếu YouTube hiển thị nút bỏ qua quảng cáo trong player, người dùng có thể bấm trực tiếp trong khung video.
              Nút “Bỏ qua bài” của KaraokeYT chỉ chuyển sang bài khác trong hàng chờ khi quảng cáo hoặc video làm gián đoạn
              buổi hát.
            </p>
          </section>

          <section className="legalSection">
            <div className="legalEyebrow">Điều khoản sử dụng</div>
            <h2>Dùng cho thiết bị và nội dung bạn có quyền sử dụng</h2>
            <p>
              Người dùng chịu trách nhiệm về nội dung phát trong buổi karaoke và cần tuân thủ điều khoản của YouTube, quyền
              tác giả, quy định địa phương và điều kiện sử dụng của địa điểm trình chiếu.
            </p>
            <p>
              Mã TV chỉ nên chia sẻ cho người trong cùng buổi sử dụng. Nếu mã bị lộ, hãy tạo mã mới trước khi tiếp tục.
            </p>
          </section>

          <section className="legalSection legalSectionWarning">
            <div className="legalEyebrow">Trước khi public</div>
            <h2>Cần thay bằng URL chính thức</h2>
            <p>
              Nội dung này là bản trong app để minh bạch với tester. Khi đưa lên Google Play/App Store/web public, cần có
              trang Privacy Policy và Terms được host bằng URL công khai, trùng khớp với khai báo trong store.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
