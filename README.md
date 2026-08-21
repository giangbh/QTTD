# QTTD Tập trung — MVP local

Ứng dụng nhập liệu thủ công hồ sơ quản trị tín dụng, xây dựng từ `PAKT_MVP_QTTD.md` và prototype biểu mẫu. Không có tích hợp hệ thống nguồn; tất cả bản ghi nghiệp vụ được đánh dấu `MANUAL` và lưu trong SQLite local.

## Chạy ứng dụng

Yêu cầu Node.js 22.5 trở lên (không cần cài thêm package):

```bash
npm start
```

Mở [http://127.0.0.1:8080](http://127.0.0.1:8080). CSDL được tạo tại `data/qttd.db`.

Có thể đổi cổng và đường dẫn CSDL:

```bash
PORT=8090 QTTD_DB_PATH=/duong/dan/qttd.db npm start
```

Chạy kiểm thử:

```bash
npm test
```

Tạo lại bộ hồ sơ mẫu (script chạy lặp sẽ bỏ qua HĐTD đã tồn tại):

```bash
npm run seed
```

## Phạm vi MVP đầu tiên

- Danh sách và tìm kiếm hồ sơ theo mã, CIF, khách hàng, HĐTD.
- Tạo, chỉnh sửa, lưu và mở lại hồ sơ.
- Nhập thông tin khách hàng, cơ cấu vốn, cấp tín dụng, đối tác liên quan.
- Nhập điều kiện TSBĐ/điều kiện tín dụng, nhiều kỳ theo dõi và điều kiện nợ.
- Chấm Xanh/Vàng/Đỏ theo ngày đánh giá, N1/N2 và ngưỡng định lượng.
- Kiểm tra bắt buộc, định dạng CIF, trùng CIF/HĐTD và xung đột phiên bản.
- Giao dịch SQLite, khóa ngoại, WAL và nhật ký mỗi lần lưu.
- Các dropdown lấy cấu hình từ bảng `danh_muc` qua `GET /api/config`.
- In hồ sơ bằng chức năng in/PDF của trình duyệt.

Chưa nằm trong MVP này: đăng nhập/phân quyền, file đính kèm, import/export Excel, phê duyệt maker-checker, job hằng đêm và tích hợp Core/TSBĐ/XHTD. Schema đã giữ `nguon_du_lieu` và `dong_bo_log` làm điểm nối cho giai đoạn sau.
