# Chấm thi trắc nghiệm bằng điện thoại – chamthi.nhp.io.vn

Hệ thống miễn phí cho giáo viên Trường THPT Bình Mỹ: quét phiếu trả lời mẫu TNMaker (24-4, 12-4) bằng camera điện thoại,
chấm ngay trên trình duyệt, hiện kết quả lên tivi lớp, lưu điểm và ảnh phiếu vào Google Sheet/Drive, xuất Excel nhập vnEdu.

| Tệp | Chức năng |
|---|---|
| `index.html` | Trang chủ |
| `quet.html` | Giáo viên quét và chấm bài (camera hoặc chọn ảnh) |
| `tv.html?lop=12A1` | Màn hình tivi lớp, có mã QR để giáo viên kết nối |
| `quantri.html` | Tạo kì thi, dán đáp án, nhập điểm tự luận, xuất Excel |
| `huong-dan.html` | Hướng dẫn triển khai và sử dụng |
| `assets/omr.js` | Bộ đọc phiếu (JavaScript thuần) |
| `assets/layouts.json` | Vị trí các ô của phiếu 24-4 và 12-4 |
| `assets/config.js` | Dán URL Apps Script vào đây |
| `apps-script/Code.gs` | Máy chủ Google Apps Script |

Triển khai: xem `huong-dan.html`, mục A. Thư viện kèm theo: qrcodejs (MIT), SheetJS Community Edition (Apache-2.0).
