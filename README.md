# Chấm thi trắc nghiệm bằng điện thoại – bản 4

Trang web miễn phí cho mọi giáo viên: https://vothanhhoa.github.io/chamthi/

- Mỗi giáo viên một tài khoản (tên đăng nhập + mật khẩu), chỉ thấy bài chấm của mình; quản trị xem tất cả.
- Phiếu tô TNMaker 24-4, 12-4 (THPT) và phiếu viết chữ A/B/C/D in từ trang (tiểu học, THCS), hoặc nhập tay.
- Ảnh phiếu, điểm lưu trên Google Drive/Sheet của quản trị; tivi lớp qua mã QR; xuất Excel nhập vnEdu.

| Tệp | Chức năng |
|---|---|
| `index.html` | Trang chủ, 4 bước bắt đầu |
| `taikhoan.html` | Đăng kí, đăng nhập, đổi mật khẩu |
| `kithi.html` | Bài kiểm tra của tôi: tạo bài, đáp án, kết quả, thống kê, Excel |
| `quet.html` | Quét chấm bằng camera / chọn ảnh / nhập tay |
| `phieu.html` | In phiếu viết chữ (2 phiếu/A4, tối đa 40 câu) |
| `tv.html` | Màn hình tivi lớp có mã QR |
| `quantri.html` | Quản trị tài khoản giáo viên |
| `huong-dan.html` | Hướng dẫn |
| `assets/omr.js`, `assets/vt.js` | Bộ đọc phiếu tô và phiếu viết chữ (JavaScript thuần, chạy trên điện thoại) |
| `apps-script/Code.gs` | Máy chủ Google Apps Script |

Thư viện kèm theo: qrcodejs (MIT), SheetJS Community Edition (Apache-2.0).
