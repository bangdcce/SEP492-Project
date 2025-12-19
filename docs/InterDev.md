# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
## 1. GIỚI THIỆU

### 1.1. Mục đích
Tài liệu này mô tả chi tiết các yêu cầu phần mềm cho hệ thống: **Nền tảng web môi giới dự án phần mềm freelance cho doanh nghiệp nhỏ (SME) tại Việt Nam**, có lớp trung gian Broker (BA/PM) và cơ chế quản lý dự án, hợp đồng, giám sát.

### 1.2. Phạm vi
Hệ thống cho phép:
* **Client (SME/chủ shop):** Tạo yêu cầu phần mềm bằng wizard có hướng dẫn, không cần biết viết spec.
* **Broker:** Nhận yêu cầu, phân tích và chuẩn hoá thành Project Spec + Milestone.
* **Freelancer:** Tạo profile, được gợi ý dự án phù hợp, nhận dự án và thực thi.
* **Staff (Supervisor):** Được Client mời vào dự án để giám sát, kiểm tra minh chứng, đề xuất nghiệm thu.
* **Admin:** Quản trị user, xác minh (KYC), duyệt Broker/Staff, theo dõi log, xử lý tranh chấp.

**Các chức năng chính:**
1.  Thu thập yêu cầu bằng Guided Input Wizard.
2.  Chuẩn hoá yêu cầu thành Spec + Milestone bởi Broker.
3.  Matching & gợi ý Freelancer dựa trên skill, rating, trust score.
4.  Hợp đồng điện tử mô phỏng + ví escrow ảo.
5.  Quản lý Project / Milestone / Task / Workspace.
6.  Minh bạch & tin cậy: KYC, chống spam, audit log, multi-step nghiệm thu, rating & trust score, xử lý tranh chấp.

### 1.3. Đối tượng người dùng
* **Client:** SME/chủ shop, ít hiểu về IT, cần UI đơn giản, workflow rõ.
* **Freelancer:** Dev freelance (sinh viên, junior, mid).
* **Broker:** Người có kinh nghiệm BA/PM, viết spec & chia milestone.
* **Staff (Supervisor):** Người được thuê để giám sát dự án.
* **Admin:** Quản trị hệ thống.

### 1.4. Thuật ngữ
* **Project Request:** Yêu cầu ban đầu từ Client.
* **Project Spec:** Đặc tả dự án sau khi Broker chuẩn hoá.
* **Milestone:** Mốc công việc lớn trong dự án.
* **Task:** Công việc chi tiết trong một milestone.
* **Escrow ảo:** Số tiền mô phỏng, giữ cho milestone.
* **KYC:** Xác thực danh tính.
* **Trust Score:** Điểm uy tín (rating + tranh chấp).

---

## 2. TỔNG QUAN HỆ THỐNG

### 2.1. Góc nhìn hệ thống
* **Kiến trúc:** Client-Server (Frontend React, Backend NestJS, Database SQL).
* **Hoạt động:** Sàn freelance tích hợp lớp Broker/Staff và công cụ quản lý dự án nhẹ.

### 2.2. Chức năng tổng quát
* Đăng ký/đăng nhập, chống spam.
* KYC & xác minh vai trò (Freelancer/Broker/Staff).
* Quy trình: Client tạo yêu cầu -> Broker tạo Spec -> Matching -> Hợp đồng -> Escrow -> Workspace -> Giám sát & Nghiệm thu -> Rating.

### 2.3. Môi trường & ràng buộc
* Giao diện tiếng Việt.
* Mức độ mô phỏng cho đồ án (email, payment, KYC).

---

## 3. CÁC CHỨC NĂNG CHÍNH (SYSTEM FEATURES)

### SF-01. Đăng ký, đăng nhập & chống spam
* **Actor:** Tất cả.
* **Hành động:** Đăng ký (chọn role), Verify email, Đăng nhập (JWT).
* **Hệ thống:** Rate limit IP, CAPTCHA, kiểm tra trạng thái accountStatus.

### SF-02. KYC (Xác thực danh tính)
* **Mục đích:** Tăng độ tin cậy.
* **Hành động:** User upload ảnh CMND/CCCD + ảnh khuôn mặt.
* **Admin:** Duyệt tay (Verified/Rejected). Freelancer chưa Verified bị hạn chế chức năng.

### SF-03. Xác minh & quản lý vai trò
* **3.1. Freelancer:** Phân cấp (New -> Verified -> Trusted) dựa trên Trust Score và KYC.
* **3.2. Broker:** User phải nộp đơn ứng tuyển (Kinh nghiệm BA/PM, CV). Admin duyệt mới được cấp role Broker.
* **3.3. Staff:** Chỉ user có `canBeStaff = true` (lịch sử tốt, trust score cao) mới được hiển thị để Client thuê giám sát.

### SF-04. Guided Input Wizard (Tạo Project Request)
* **Actor:** Client.
* **Quy trình:** Wizard 5 bước (Loại sản phẩm -> Lĩnh vực -> Ngân sách/Thời gian -> Chức năng -> Mô tả ý tưởng).
* **Output:** Project Request (Trạng thái: PENDING_BROKER).

### SF-05. Broker xử lý Request & tạo Spec
* **Actor:** Broker.
* **Quy trình:** Nhận Request -> Chat với Client -> Tạo Spec (Mô tả hệ thống, Role, In/Out scope) -> Tạo Milestone (Tiền, Thời gian) -> Gửi Client duyệt.
* **Output:** Spec v1.0, Request chuyển trạng thái sang APPROVED_FOR_MATCHING.

### SF-06. Matching & Gợi ý Freelancer
* **Hệ thống:** Lọc Freelancer theo Skill (từ Spec), KYC Verified, Trust Score cao. Tính điểm match.
* **Quy trình:** Broker lọc shortlist -> Client xem profile và chọn "Mời tham gia" -> Freelancer Accept/Reject.

### SF-07. Hợp đồng điện tử & Escrow ảo
* **Hành động:** Hệ thống sinh Contract từ Spec. Hai bên bấm "Ký". Client nạp tiền vào "Escrow ảo".
* **Kết quả:** Contract Active, Escrow Funded.

### SF-08. Khởi tạo Project & Workspace
* **Không gian làm việc:** Dashboard, Task board, Chat.
* **Thành viên:** Client, Broker, Freelancer, Staff (nếu được mời).

### SF-09. Quản lý Task & Tiến độ
* **Hành động:** Broker/Freelancer tạo Task. Freelancer update trạng thái (Todo -> In Progress -> Done).
* **Hệ thống:** Tính % hoàn thành Milestone hiển thị trên Dashboard.

### SF-10. Staff giám sát & Đề xuất nghiệm thu
* **Actor:** Staff, Client.
* **Hành động:** Staff kiểm tra output của Freelancer, viết comment nhận xét, chọn đề xuất "Chấp nhận" hoặc "Từ chối" để Client tham khảo.

### SF-11. Nghiệm thu Milestone & Giải ngân Escrow
* **Quy trình:** Freelancer yêu cầu nghiệm thu -> (Staff review) -> Client quyết định.
* **Kết quả:**
    * Client Approve -> Release tiền escrow ảo cho Freelancer.
    * Client Reject -> Freelancer phải sửa.

### SF-12. Đánh giá, Trust Score & Cảnh báo
* **Đánh giá:** Rating chéo sau khi hoàn thành project.
* **Trust Score:** Tính dựa trên Rating trung bình + Số project hoàn thành + Số tranh chấp thua.
* **Hiển thị:** Huy hiệu (New/Verified/Trusted) và cảnh báo nếu có nhiều tranh chấp.

### SF-13. Admin, Audit Log & Quản lý tranh chấp
* **Audit Log:** Ghi lại mọi hành động quan trọng (Ai làm gì, lúc nào).
* **Quản lý User:** Ban/Unban, Duyệt KYC/Broker.
* **Dispute:** Admin xem log, chat, minh chứng -> Phán quyết lỗi thuộc về ai -> Cập nhật tiền và Trust Score.

---

## 4. YÊU CẦU PHI CHỨC NĂNG
* **Usability:** Giao diện tiếng Việt, thân thiện cho SME.
* **Bảo mật:** JWT, Hash password, RBAC, Chống spam (Captcha, Rate limit).
* **Hiệu năng:** Ổn định với hàng trăm user demo.
* **Khả năng mở rộng:** Kiến trúc Module (NestJS), tách biệt các service.

## 5. PHẠM VI ĐỒ ÁN
* Thực hiện các chức năng SF-01 đến SF-13 ở mức độ mô phỏng (Simulated Payment/Email/Contract).
* Triển khai trên môi trường demo (Docker đơn giản).