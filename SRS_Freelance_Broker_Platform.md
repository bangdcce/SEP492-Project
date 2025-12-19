
# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

## Hệ thống
**Nền tảng môi giới dự án phần mềm freelance cho SME Việt Nam với lớp “Broker”**

---

## 1. GIỚI THIỆU

### 1.1. Mục đích
Tài liệu này mô tả chi tiết các yêu cầu phần mềm cho hệ thống nền tảng web môi giới dự án phần mềm freelance dành cho SME tại Việt Nam, có lớp trung gian Broker (BA/PM) và cơ chế quản lý dự án, hợp đồng, giám sát.

### 1.2. Phạm vi
Hệ thống cho phép Client tạo yêu cầu phần mềm bằng wizard, Broker chuẩn hóa thành Project Spec và Milestone, Freelancer thực thi dự án, Staff giám sát và Admin quản trị toàn hệ thống.

### 1.3. Đối tượng người dùng
- Client (SME/chủ shop)  
- Freelancer  
- Broker (BA/PM)  
- Staff (Supervisor)  
- Admin  

### 1.4. Thuật ngữ
- SME: Doanh nghiệp nhỏ và vừa  
- Broker: BA/PM trung gian  
- Escrow ảo: Cơ chế giữ tiền mô phỏng  
- Trust Score: Điểm uy tín  

---

## 2. TỔNG QUAN HỆ THỐNG

### 2.1. Góc nhìn hệ thống
- Frontend: React  
- Backend: NestJS (REST API)  
- Database: MySQL / PostgreSQL  

### 2.2. Chức năng tổng quát
- Quản lý tài khoản, KYC  
- Tạo và chuẩn hóa yêu cầu dự án  
- Matching Freelancer  
- Quản lý Project / Milestone / Task  
- Hợp đồng điện tử & escrow ảo  

### 2.3. Môi trường & ràng buộc
- Web-based, giao diện tiếng Việt  
- Nhiều chức năng ở mức mô phỏng cho đồ án  

---

## 3. CÁC CHỨC NĂNG CHÍNH (SYSTEM FEATURES)

### SF-01. Đăng ký, đăng nhập & chống spam
Cho phép tạo tài khoản, xác thực email, sử dụng CAPTCHA và rate limit.

### SF-02. KYC (xác thực danh tính)
Upload CCCD/CMND, Admin duyệt để tăng độ tin cậy.

### SF-03. Xác minh & quản lý vai trò
- Freelancer & cấp độ uy tín  
- Ứng tuyển làm Broker  
- Xác định Staff giám sát  

### SF-04. Guided Input Wizard – Tạo Project Request
Wizard từng bước giúp Client mô tả yêu cầu có cấu trúc.

### SF-05. Broker tạo Project Spec & Milestone
Chuẩn hóa yêu cầu, tạo đặc tả kỹ thuật và milestone.

### SF-06. Matching & gợi ý Freelancer
Gợi ý dựa trên skill, Trust Score và KYC.

### SF-07. Hợp đồng điện tử & Escrow ảo
Mô phỏng ký hợp đồng và giữ tiền theo milestone.

### SF-08. Khởi tạo Project & Workspace
Tạo dashboard, task board, chat và danh sách thành viên.

### SF-09. Quản lý Task & tiến độ
Theo dõi task, milestone và tiến độ dự án.

### SF-10. Staff giám sát & đề xuất nghiệm thu
Staff kiểm tra và đề xuất chấp nhận/từ chối milestone.

### SF-11. Nghiệm thu Milestone & giải ngân Escrow
Client quyết định nghiệm thu, hệ thống giải ngân escrow.

### SF-12. Đánh giá, Trust Score & tranh chấp
Rating, tính Trust Score và cảnh báo tranh chấp.

### SF-13. Admin, Audit Log & Quản lý tranh chấp
Quản trị hệ thống, log và xử lý tranh chấp.

---

## 4. YÊU CẦU PHI CHỨC NĂNG

### 4.1. Usability
UI tiếng Việt, wizard rõ ràng, dashboard theo role.

### 4.2. Bảo mật & Minh bạch
JWT, hash mật khẩu, phân quyền, audit log.

### 4.3. Hiệu năng
Phù hợp môi trường demo với hàng trăm user.

### 4.4. Khả năng mở rộng
Thiết kế module, sẵn sàng tích hợp AI, payment, eKYC.

---

## 5. PHẠM VI ĐỒ ÁN & HƯỚNG PHÁT TRIỂN

### 5.1. Phạm vi đồ án
Triển khai SF-01 → SF-13 ở mức cơ bản, mô phỏng.

### 5.2. Hướng phát triển
- AI refine requirement & matching  
- eKYC & thanh toán thật  
- Hợp đồng điện tử pháp lý  
