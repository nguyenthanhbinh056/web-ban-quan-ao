# STUDIO Fashion — Node.js + Express

Website bán quần áo đa phân hệ: khách hàng, nhân viên, quản trị viên.
Dữ liệu demo được lưu trong `data/store.json` để chạy thử không cần cài MySQL.

## Yêu cầu
- Node.js 18 trở lên

## Chạy trên Windows / VS Code
1. Giải nén ZIP.
2. Mở đúng thư mục có `package.json` trong VS Code.
3. Mở Terminal và chạy:
   ```bash
   npm install
   npm start
   ```
4. Mở http://localhost:3000

## Tài khoản demo
- Admin: `admin@studio.local` / `Admin123!`
- Nhân viên: `staff@studio.local` / `Staff123!`
- Khách hàng: `customer@studio.local` / `Customer123!`

Đổi mật khẩu demo sau khi đăng nhập nếu dùng môi trường thật. Đây là bộ khung chạy thử; trước khi triển khai thực tế cần dùng database phù hợp, HTTPS, cấu hình session an toàn, xác thực CSRF, giới hạn đăng nhập và kiểm thử bảo mật.


## Hiển thị phương thức thanh toán
- Trang Admin hiển thị phương thức thanh toán, tình trạng thanh toán và trạng thái đơn hàng.
- Trang Nhân viên và lịch sử đơn hàng của khách cũng hiển thị tên phương thức dễ hiểu.
- COD, VietQR và ví điện tử là các lựa chọn được lưu cùng đơn hàng; VietQR/ví điện tử chưa tự động xác minh giao dịch thật.
