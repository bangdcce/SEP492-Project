**TÀI LIỆU THIẾT KẾ: HỆ THỐNG ĐẢM BẢO CHẤT LƯỢNG & PHÁP LÝ (PROJECT
GOVERNANCE SYSTEM)**

**Mục tiêu:** Loại bỏ sự mơ hồ trong đặc tả yêu cầu (Spec), ngăn chặn
tranh chấp (Dispute), và tự động hóa việc tạo hợp đồng. **Nguyên tắc:**
\"Code is Law\" (Dữ liệu quy định Luật chơi).

## PHẦN 1: TƯ DUY THIẾT KẾ (DESIGN PHILOSOPHY)

Thay vì dựa vào sự tin tưởng giữa người với người, hệ thống InterDev sử
dụng **Cấu trúc dữ liệu (Data Structure)** để ép buộc sự minh bạch.

1.  **Input Chặt chẽ:** Không cho nhập văn bản tự do (Free Text), bắt
    > buộc nhập theo khối (Block-based).

2.  **Validation Thời gian thực:** Bắt lỗi từ ngữ mơ hồ ngay khi gõ.

3.  **Output Tự động:** Hợp đồng pháp lý không được viết tay, mà được
    > sinh ra (Render) từ dữ liệu đã duyệt.

## PHẦN 2: CÁC MODULE CHỨC NĂNG (CORE MODULES)

### 1. Trình soạn thảo Spec Cấu trúc (The Structured Spec Editor)

*Thay thế file Word/Docs truyền thống.*

-   **Công nghệ:** React (TipTap / SlateJS).

-   **Cơ chế:** Giao diện giống Notion nhưng bị giới hạn quyền
    > (Restricted Block Types).

-   **Cấu trúc dữ liệu (JSON):**

    -   ProjectSpec chứa danh sách Features.

    -   Mỗi Feature bắt buộc có: Tên, Mô tả, Độ khó, và **Acceptance
        > Criteria (Tiêu chí nghiệm thu)**.

-   **Chống \"Lùa gà\" (Template Library):**

    -   Hệ thống cung cấp Template chuẩn cho các loại dự án phổ biến
        > (VD: E-commerce Standard).

    -   Template đã điền sẵn 80% yêu cầu kỹ thuật cứng (Load time,
        > Security, SEO). Broker chỉ điền 20% yêu cầu nghiệp vụ. -\>
        > *Ngăn Broker xóa bỏ các tiêu chuẩn chất lượng cơ bản.*

    -   *Mấy cái không có thì bắt soạn theo notion style, phải có không
        > gian cho mermaid code gen thành diagram hoặc upload ảnh .Yêu
        > cầu có các trường chỉ định công nghệ rõ ràng (VD NestJs, React
        > dùng cho việc gì )*

    -   *Cho phép dùng json để định nghĩa input và output cho từng chức
        > năng*

### 2. Bộ lọc \"Từ điển Cấm\" (The Keyword Warning System)

*Máy lọc sơ cấp để nhắc nhở Broker.*

-   **Logic:** Hệ thống duy trì một danh sách BANNED_KEYWORDS.

    -   *Từ ngữ cảm tính:* \"Đẹp\", \"Sang trọng\", \"Hiện đại\", \"Thân
        > thiện\".

    -   *Từ ngữ định tính:* \"Nhanh\", \"Tốt\", \"Mạnh mẽ\", \"Cao
        > cấp\".

-   **UX Flow:**

    -   Broker gõ: *\"Giao diện phải hiện đại.\"*

    -   Hệ thống gạch chân đỏ + Tooltip: ⚠️ *\"Từ \'Hiện đại\' gây tranh
        > cãi. Hãy mô tả cụ thể: Màu sắc gì? Style Material hay Flat?
        > Tham khảo trang nào?\"*

    -   Broker gõ: *\"Hệ thống chạy nhanh.\"*

    -   Tooltip: ⚠️ *\"Hãy dùng con số: Tải trang dưới X giây.\"*

### 3. Cơ chế \"Ép buộc\" Nghiệm thu (Forced Acceptance Criteria)

*Chuyển đổi từ Văn văn sang Logic Đúng/Sai (Boolean Logic).*

-   **Vấn đề:** Spec cũ chỉ ghi \"Làm chức năng đăng nhập\". -\>
    > *Freelancer làm xong, Client bảo chưa đạt.*

-   **Giải pháp:** Trong mỗi Feature Card, trường Acceptance Criteria là
    > bắt buộc và phải là dạng **Checklist**.

-   **Validation Rule:**

    -   Không cho phép checklist trống.

    -   Độ dài tối thiểu của mỗi dòng \> 10 ký tự (Chống spam).

-   **Ví dụ chuẩn:**

    -   \[ \] User nhập đúng -\> Chuyển trang Home.

    -   \[ \] User nhập sai -\> Báo lỗi đỏ.

    -   \[ \] Quên mật khẩu -\> Gửi mail OTP.

### 4. Sàn Kiểm Duyệt & Random Audit (The Human Firewall)

*Lớp bảo vệ cuối cùng trước khi Spec đến tay Client.*

-   **Quy trình:** Spec sau khi Submit -\> Trạng thái PENDING_AUDIT.

-   **Logic phân phối:**

    -   Broker mới (Uy tín thấp): 100% Spec được Staff duyệt thủ công.

    -   Broker VIP: Duyệt ngẫu nhiên 20% (Random Audit).

-   **Hành động của Staff:**

    -   Nếu thấy Spec sơ sài -\> Bấm **Reject** + Lý do (VD: \"Thiếu sơ
        > đồ ERD\").

    -   Spec bị Reject -\> Broker phải sửa lại.

-   **Tác dụng:** Tạo áp lực tâm lý để Broker không dám viết bậy.

## PHẦN 3: ĐẦU RA PHÁP LÝ (LEGAL OUTPUT)

### 1. Hợp đồng Động (Dynamic Contract Generation)

-   **Công nghệ:** pdfmake hoặc react-pdf (Server-side rendering).

-   **Nguyên lý:** Hợp đồng PDF được tạo ra tức thì từ JSON Spec đã
    > chốt.

-   **Nội dung tự động điền:**

    -   **Phạm vi công việc (Scope):** Lấy toàn bộ danh sách Feature và
        > Criteria từ DB in vào Phụ lục.

    -   **Tiến độ (Milestone):** Lấy ngày tháng và số tiền từ bảng
        > Milestone in vào Điều khoản thanh toán.

    -   **Điều khoản ẩn (Che KYC):** Tự động mask thông tin cá nhân của
        > Client/Freelancer, thay bằng UserID.

-   **Giá trị:** Không ai có thể lén sửa một câu chữ trong file Word để
    > gài bẫy đối phương.

### 2. Quản lý Thay đổi (Change Request - CR)

-   Khi muốn sửa Spec sau khi đã ký Hợp đồng:

    -   Không sửa đè lên Spec cũ.

    -   Tạo bản ghi ChangeRequest mới (Tính năng thêm, Tiền thêm).

    -   Hai bên bấm nút \"Đồng ý\" trên UI.

    -   Hệ thống sinh ra file PDF **\"Phụ lục Hợp đồng số 0X\"**.

# BỔ SUNG TÀI LIỆU THIẾT KẾ: BẢO MẬT & RÀNG BUỘC (SECURITY & CONSTRAINTS ADDENDUM)

## MODULE 5: HỆ THỐNG MILESTONE THÔNG MINH (SMART MILESTONE VALIDATOR)

Khác với các sàn Freelance thông thường cho nhập số tiền tùy ý, InterDev
áp dụng \"Hard Constraints\" (Ràng buộc cứng) để bảo vệ dòng tiền.

### 1. Luật chia tiền (Budget Validation Rules)

Khi Broker nhập liệu bảng Milestone, hệ thống chạy ngay các hàm kiểm tra
(Validation logic) sau. Nếu vi phạm -\> Báo lỗi đỏ, không cho Submit.

-   **Rule 1: Chống \"Front-loading\" (Rủi ro cho Client)**

    -   *Quy định:* Milestone 1 (Đặt cọc/Khởi động) **không được vượt
        > quá 30%** tổng ngân sách.

    -   *Lý do:* Ngăn Broker/Freelancer lấy tiền cọc lớn rồi bỏ chạy.

-   **Rule 2: Đảm bảo hoàn thành (Rủi ro cho Dự án)**

    -   *Quy định:* Milestone cuối cùng (Final Delivery & Handover)
        > **phải tối thiểu 20%** tổng ngân sách.

    -   *Lý do:* Để Freelancer có động lực làm đến bước bàn giao cuối
        > cùng (Source code, Documents) mới nhận được cục tiền này.

-   **Rule 3: Tính toàn vẹn (Integrity)**

    -   *Quy định:* Tổng % các Milestone phải **chính xác bằng 100%**.
        > (99.9% hay 100.1% đều Reject).

### 2. Ràng buộc Loại bàn giao (Deliverable-Type Mapping)

Mỗi Milestone bắt buộc phải chọn một Deliverable Type (Loại sản phẩm).
Hệ thống sẽ quy định input bắt buộc cho việc nghiệm thu sau này dựa trên
loại đã chọn.

  -------------------------------------------------------------------------
  **Giai đoạn    **Loại bàn giao       **Yêu cầu nghiệm thu (System
  (Phase)**      (Type)**              Requirement)**
  -------------- --------------------- ------------------------------------
  **Thiết kế**   DESIGN_PROTOTYPE      Bắt buộc nhập: Link Figma/Adobe XD
                                       (Regex check domain).

  **Backend**    API_DOCS              Bắt buộc nhập: Link Swagger/Postman
                                       Collection.

  **Frontend**   DEPLOYMENT            Bắt buộc nhập: Link Demo
                                       (Vercel/Netlify/Staging IP).

  **Bàn giao**   SOURCE_CODE           Bắt buộc nhập: Link Git Repository
                                       (GitHub/GitLab).
  -------------------------------------------------------------------------

-\> **Tác dụng:** Broker không thể tạo một Milestone tên là \"Triển
khai\" chung chung mà không xác định rõ sẽ nộp cái gì.

Trong thực tế, **\"Code chạy được trên máy Dev\" khác hoàn toàn với \"Hệ
thống sống được trên Production\"**. Rất nhiều dự án chết yểu vì
Freelancer bàn giao code xong, nhận tiền rồi biến mất, để lại Client với
một mớ code không biết deploy, không biết fix bug, và không có tài liệu
vận hành.

Để giải quyết bài toán \"Hậu dự án\" (Post-Project) và rủi ro nhân sự
(Bus Factor) này, chúng ta cần nâng cấp hệ thống **Deliverable Mapping**
và thêm cơ chế **Warranty & Retention (Bảo hành & Giữ tiền)**.

Dưới đây là thiết kế bổ sung để hệ thống đạt chuẩn \"Production-Ready\":

### 1. BỔ SUNG: CÁC LOẠI BÀN GIAO \"SỐNG CÒN\" (CRITICAL DELIVERABLE TYPES)

Ngoài Code và Design, hệ thống bắt buộc phải có thêm 2 loại Deliverable
đặc biệt cho giai đoạn cuối. Nếu thiếu 2 cái này -\> Không cho phép tất
toán hợp đồng.

+----------------------+-----------+----------------------------------+
| **Loại bàn giao      | **Ý       | **Input bắt buộc (Validation     |
| (Type)**             | nghĩa**   | Rules)**                         |
+======================+===========+==================================+
| **                   | **Tài     | **1. Deployment Guide:** File    |
| SYS_OPERATION_DOCS** | liệu Vận  | Markdown/Wiki hướng dẫn deploy   |
|                      | hành &    | (bắt buộc có lệnh Docker).       |
|                      | Cứu hộ**  |                                  |
|                      |           | **2. Env Template:** File        |
|                      |           | .env.example (Không chứa pass    |
|                      |           | thật, nhưng chứa tên biến).      |
|                      |           |                                  |
|                      |           | **3. Disaster Recovery:** Hướng  |
|                      |           | dẫn \"Khi server sập thì làm     |
|                      |           | gì?\" (Restart service nào,      |
|                      |           | check log ở đâu).                |
+----------------------+-----------+----------------------------------+
| **CREDENTIAL_VAULT** | **Bàn     | **Asset Locker:** Freelancer     |
|                      | giao Chìa | phải nhập thông tin vào \"Két    |
|                      | khóa      | sắt số\" của sàn (Root Pass,     |
|                      | (Key)**   | Cloud Key, Admin Account).       |
|                      |           |                                  |
|                      |           | -\> *Client chỉ nhận được chìa   |
|                      |           | khóa này khi đã thanh toán đủ.*  |
+----------------------+-----------+----------------------------------+

### 2. CƠ CHẾ \"GIAI ĐOẠN ỔN ĐỊNH\" (THE STABILITY PERIOD & RETENTION)

Để đảm bảo code \"chạy được lâu\" chứ không phải chỉ chạy lúc demo,
chúng ta đưa vào khái niệm **\"Retention Money\" (Tiền giữ lại đảm
bảo)**.

-   **Logic Hợp đồng:**

    -   Khi Freelancer bàn giao xong Mốc cuối (Final Delivery), hệ thống
        > **CHƯA TRẢ HẾT 100% TIỀN**.

    -   Hệ thống tự động giữ lại **10% - 20%** (gọi là *Retention
        > Amount*) trong ví trung gian (Escrow).

    -   Số tiền này sẽ được giải ngân sau **X ngày** (VD: 30 ngày) gọi
        > là **\"Giai đoạn bảo hành nóng\"**.

-   **Điều kiện giải ngân 20% cuối cùng:**

    -   Trong 30 ngày đó, nếu hệ thống Production bị Crash hoặc lỗi
        > Critical -\> Client bấm nút \"Report Bug\".

    -   Freelancer phải vào fix. Nếu fix xong -\> Đồng hồ đếm ngược chạy
        > tiếp.

    -   Nếu Freelancer bỏ chạy (Ghosting) -\> Dùng 20% tiền đó thuê
        > người khác fix hoặc refund cho Client.

### 3. QUY TRÌNH \"BUS FACTOR\" (XỬ LÝ KHI NHÂN SỰ NGHỈ VIỆC)

Đây là giải pháp cho câu hỏi: *\"Lỡ Broker/Freelancer nghỉ thì sao?\"*.
Hệ thống phải ép buộc Freelancer tạo ra **\"Bộ Kit Thay Thế\"
(Replacability Kit)** ngay từ đầu.

Yêu cầu kỹ thuật bắt buộc (Technical Requirement):

Trong SYS_OPERATION_DOCS, hệ thống bắt buộc Freelancer phải cung cấp
phương án \"Dockerization\" (Đóng gói Container).

-   **Tại sao là Docker?**

    -   Vì Docker triệt tiêu vấn đề *\"Máy em chạy được mà máy server
        > không chạy\"* (It works on my machine).

    -   Khi Freelancer A nghỉ, Broker tuyển Freelancer B vào. Freelancer
        > B chỉ cần gõ đúng 1 lệnh: docker-compose up là dự án chạy lên
        > ngay, không cần cài cắm môi trường phức tạp.

**Quy trình kiểm tra (Automated Handover Check):**

1.  Trước khi nghiệm thu Mốc cuối, Hệ thống yêu cầu Freelancer chạy một
    > lệnh test trên môi trường sạch (Clean Environment).

2.  Hệ thống ghi lại log. Nếu build thành công -\> Mới cho phép Submit.

3.  -\> Đảm bảo người sau vào tiếp quản được ngay lập tức.

### 4. MODULE BẢO TRÌ & BẢO HÀNH (MAINTENANCE & WARRANTY MODE)

Sau khi dự án kết thúc (Hợp đồng Dev đóng lại), hệ thống gợi ý mở tiếp
**\"Hợp đồng Bảo trì\" (Maintenance Contract)**.

-   **Phân biệt rõ ràng:**

    -   **Bảo hành (Warranty):** (Miễn phí, bắt buộc theo Hợp đồng Dev)
        > Sửa lỗi do code sai gây ra trong thời hạn cam kết (VD: 3
        > tháng).

    -   **Bảo trì (Maintenance):** (Thu phí hàng tháng) Nâng cấp thư
        > viện, backup dữ liệu, monitor server, hỗ trợ user.

-   **Tính năng trên Sàn:**

    -   Nếu Client tick chọn \"Mua gói bảo trì\" -\> Hệ thống tự tạo Hợp
        > đồng định kỳ (Subscription Contract).

    -   Hàng tháng tự trừ tiền Client -\> Chuyển cho Freelancer/Broker.

    -   Bắt buộc Freelancer phải upload **Log Report** hàng tháng (VD:
        > Uptime 99.9%, đã backup ngày 01/10\...) thì mới nhận được tiền
        > tháng đó.

### 5. TỔNG HỢP FLOW CHUẨN CÔNG NGHIỆP (INDUSTRIAL STANDARD FLOW)

Đây là quy trình hoàn thiện nhất, bao gồm cả các Edge Case bạn vừa nêu:

1.  **Dev Phase:** Làm theo Milestone -\> Nghiệm thu từng phần
    > (Video/Demo).

2.  **Handover Phase (Quan trọng):**

    -   Upload Docker file (Chống phụ thuộc người làm).

    -   Upload Docs Vận hành (Wiki chuẩn cấu trúc).

    -   Nhập Credentials vào Vault (Két sắt).

3.  **Production Verification:** Deploy lên Server thật của Client.

4.  **Retention Phase (30 ngày):**

    -   Client giữ 20% tiền.

    -   Hệ thống monitor Uptime.

5.  **Final Release:**

    -   Hết 30 ngày không lỗi -\> Trả 20% còn lại.

    -   Hệ thống tự động gửi Credentials trong Vault cho Client (Bàn
        > giao chủ quyền).

6.  **Maintenance Phase:** Ký tiếp hợp đồng bảo trì (Option).

## MODULE 6: BẢO MẬT DỮ LIỆU JSON (ANTI-INJECTION & SANITIZATION)

Vấn đề bạn lo ngại: Broker chèn script độc hại
(\<script\>alert(\'hacked\')\</script\>) vào JSON mô tả, khi Client mở
lên xem sẽ bị dính mã độc (XSS).

### Giải pháp kỹ thuật: Quy trình \"Lọc đầu vào - Khử đầu ra\"

1.  **Validation Cấu trúc (Schema Validation - Zod/Joi):**

    -   Backend kiểm tra JSON gửi lên có đúng format không.

    -   Chỉ chấp nhận các trường đã định nghĩa (Title, Description\...).
        > Các trường lạ tự thêm vào sẽ bị **Strip** (loại bỏ) ngay lập
        > tức.

2.  **Làm sạch dữ liệu (Sanitization - DOMPurify):**

    -   Trước khi lưu vào Database (hoặc ngay khi render ở Frontend), sử
        > dụng thư viện DOMPurify để quét toàn bộ các chuỗi văn bản
        > (String).

    -   Nó sẽ loại bỏ tất cả các thẻ nguy hiểm (script, iframe, object,
        > onclick\...) nhưng giữ lại các thẻ format an toàn (b, i, ul,
        > li).

3.  **Cơ chế lưu trữ ảnh/file:**

    -   Tuyệt đối không lưu Base64 ảnh trong JSON (làm nặng DB).

    -   JSON chỉ lưu URL ảnh (https://storage.interdev.com/\...).

    -   Domain của ảnh phải nằm trong Whitelist (chỉ chấp nhận link từ
        > Bucket của hệ thống, không chấp nhận link ảnh từ web lạ).

## MODULE 7: HỢP ĐỒNG RIÊNG TƯ (DUAL-VIEW CONTRACT SYSTEM)

Bạn đặt vấn đề rất đúng: Client và Freelancer cần ký hợp đồng, nhưng họ
không muốn lộ Số CMND/CCCD, Địa chỉ nhà riêng cho người lạ (đối phương)
biết.

Giải pháp: Mô hình \"Mặt nạ thông tin\" (Information Masking).

Hệ thống sẽ sinh ra 2 phiên bản PDF cho cùng một Hợp đồng:

### Phiên bản 1: Hợp đồng Giao kết (User Version - Public View)

*Đây là file Client và Freelancer nhìn thấy và tải về.*

-   **Thông tin định danh:**

    -   Bên A (Client): Hiển thị Tên hiển thị (Display Name) + User ID
        > (VD: CLIENT_007).

    -   Bên B (Freelancer): Hiển thị Tên hiển thị + User ID (VD:
        > DEV_99).

-   **Thông tin nhạy cảm:**

    -   Số CCCD/Passport: \*\*\*\*\*\*\*\*\*\*\*\* (Được che).

    -   Địa chỉ/SĐT: *\"Thông tin chi tiết đã được xác thực (KYC) và lưu
        > trữ bảo mật tại máy chủ Sàn InterDev theo chính sách quyền
        > riêng tư.\"*

-   **Điều khoản pháp lý:** *\"Bằng việc ký số vào văn bản này, hai bên
    > thừa nhận danh tính thực (Legal Identity) tương ứng với User ID đã
    > được đăng ký và xác thực trên hệ thống.\"*

### Phiên bản 2: Hợp đồng Lưu chiểu (Master Version - Admin View)

*Đây là file chỉ Admin và Hệ thống pháp lý nhìn thấy.*

-   Lưu trữ trong **Secure Vault** (Kho lưu trữ bảo mật) của Server.

-   Hiển thị **ĐẦY ĐỦ** tên thật, số CCCD, địa chỉ, số điện thoại của
    > hai bên.

-   **Mục đích:** Chỉ được trích xuất (Decrypt) khi có tranh chấp pháp
    > lý (Dispute) cần ra tòa án hoặc cơ quan chức năng yêu cầu.

### Quy trình Ký số (Digital Signature Flow)

1.  Client bấm nút \"Ký Hợp đồng\".

2.  Hệ thống yêu cầu nhập Mật khẩu cấp 2 / OTP / Chữ ký số.

3.  Hệ thống ghi nhận Hash của hành động ký vào Database, liên kết với
    > **Master Version**.

4.  Cả Client và Freelancer đều yên tâm làm việc mà không sợ bị lộ thông
    > tin cá nhân ra ngoài.

### 1. MILESTONE DATABASE (Khó nhất với Client)

**Vấn đề:** Client nhận file dump.sql. Họ không biết cài MySQL/Postgres
để mở. **Giải pháp:**

-   **A. Trình diễn Schema (Schema Visualizer):**

    -   Khi Freelancer up file SQL hoặc JSON Schema, hệ thống (Backend)
        > sẽ parse file đó.

    -   Frontend sử dụng thư viện (như React Flow hoặc Mermaid.js) để vẽ
        > ra sơ đồ **ERD đơn giản hóa**:

        -   Bảng User: Có cột Tên, Email, Pass.

        -   Bảng Product: Có cột Giá, Ảnh.

    -   -\> Client nhìn vào: \"À, có bảng Lưu người dùng, có bảng Lưu
        > hàng hóa. Ok đúng ý tôi.\"

-   **B. Báo cáo Tự động (Health Check Report):**

    -   Hệ thống chạy script đếm: \"File này chứa 15 Bảng, 50 dòng dữ
        > liệu mẫu (Seed Data)\".

    -   Cảnh báo đỏ nếu: File rỗng (0KB), hoặc không có bảng nào.

### 2. MILESTONE API / BACKEND

**Vấn đề:** Client không biết dùng Postman/Swagger. **Giải pháp:**
**\"No-Code API Tester\"** tích hợp sẵn.

-   Broker/Freelancer phải cấu hình sẵn một vài nút test trên giao diện
    > nghiệm thu.

-   Ví dụ: Nút \"Test Đăng nhập\".

    -   Client bấm nút -\> Hệ thống gọi API ngầm.

    -   Hiện kết quả màu Xanh: \"Đăng nhập thành công! Token trả về:
        > abc\...\"

    -   Hiện kết quả màu Đỏ: \"Lỗi Server 500\".

-   -\> Client chỉ cần bấm nút để biết API có sống hay không, không cần
    > đọc code.

### 3. MILESTONE DESIGN (FIGMA/UI)

**Vấn đề:** Client nhận link Figma nhưng lạc trôi trong đó, không biết
xem màn nào. **Giải pháp:** **Embedded Prototype & Screen Flow.**

-   Yêu cầu Freelancer dán \"Embed Link\" (Link nhúng) của Figma thay vì
    > link thường.

-   Hệ thống hiển thị khung Figma ngay trên web InterDev.

-   **Bắt buộc:** Phải chụp ảnh màn hình (Screenshot) các màn chính
    > (Home, Login, Cart) up lên cạnh link Figma.

-   -\> Client so sánh: Ảnh cam kết trong Spec vs Ảnh thực tế bàn giao.

### 4. MILESTONE SOURCE CODE (Bàn giao cuối)

**Vấn đề:** Client không biết check code chất lượng hay rác. **Giải
pháp:** **Tích hợp Git & Video Demo.**

-   **Bắt buộc Video Demo:** Hệ thống yêu cầu Freelancer phải upload một
    > video quay màn hình (Screen Recording) thao tác chạy thử tính năng
    > từ A-Z (Up lên Youtube/Vimeo chế độ Private và dán link vào).

    -   Đây là bằng chứng thép. Nếu code không chạy được, Freelancer
        > không thể quay video trơn tru được.

-   **Git Stats:** Hệ thống kết nối GitHub API, hiện thông số: \"Đã có
    > 50 Commits\", \"Lần update cuối: 1 giờ trước\". Nếu thấy \"Last
    > update: 1 tháng trước\" -\> Client biết ngay là lấy code cũ lừa
    > đảo.

### TỔNG HỢP QUY TRÌNH NGHIỆM THU (VALIDATION FLOW)

Để Client \"dám\" bấm nút Duyệt, quy trình trên UI sẽ như sau:

1.  **Freelancer Submit:** Upload file/link + **Bắt buộc dán Link Video
    > Demo**.

2.  **System Auto-Check:**

    -   Check file DB có rỗng không?

    -   Check Link Figma có sống (Live) không?

    -   Check API endpoint có ping được không?

3.  **Client View:**

    -   Xem Video Demo đầu tiên (Dễ hiểu nhất).

    -   Xem các biểu đồ/Visualizer mà hệ thống tạo ra.

    -   Xem so sánh với Spec ban đầu (Hệ thống hiện 2 cột: Yêu cầu vs
        > Bàn giao).

4.  **Action:** Client bấm \"Duyệt\" hoặc \"Yêu cầu sửa\" (Kèm comment
    > cụ thể vào từng mục).

**Kết luận cho Đồ án:** Bạn không cần làm trình biên dịch (Compiler)
phức tạp. Bạn chỉ cần làm các **Parser** (Bộ phân tích) đơn giản để hiển
thị thông tin metadata của file bàn giao. Cộng với yêu cầu bắt buộc về
**Video Demo**, bài toán \"Client mù tịt công nghệ\" sẽ được giải quyết
90%.

**1. QUY TRÌNH \"TRANH CHẤP SỐ\" (DIGITAL DISPUTE RESOLUTION)**

**Vấn đề:** Dù Spec chuẩn, Client vẫn có thể chày cối \"Tôi không
thích\". Hoặc Freelancer làm ẩu nhưng cãi cùn. Khi đó, Admin của sàn
nhảy vào phân xử dựa trên cái gì? **Giải pháp:** **Evidence-based
Arbitration (Phân xử dựa trên bằng chứng).**

Chúng ta không phân xử bằng \"lời nói\", chúng ta phân xử bằng
\"Snapshot\".

-   **Snapshot Spec:** Khi ký Hợp đồng, hệ thống đã lưu 1 bản snapshot
    > của Spec.

-   **Snapshot Nghiệm thu:** Khi Freelancer bấm \"Submit\", hệ thống lưu
    > lại Link Demo, Video, Code Commit tại thời điểm đó.

-   **Quy trình:**

    1.  Client bấm nút **\"Khiếu nại\" (Dispute)**.

    2.  Hệ thống **đóng băng tiền** (Escrow Lock).

    3.  Admin mở giao diện \"So sánh\" (Comparison View):

        -   Bên trái: Acceptance Criteria (Đã chốt).

        -   Bên phải: Bằng chứng Freelancer nộp (Video/Link).

    4.  Admin tích chọn:

        -   Criteria 1: Đạt.

        -   Criteria 2: Không đạt (Video không hiển thị chức năng này).

    5.  **Kết quả:** Hệ thống tự tính toán. Nếu đạt \> 80% -\> Refund
        > 20% cho Client, trả 80% cho Dev. (Hoặc logic tùy luật sàn).

-\> **Giá trị:** Biến việc cãi nhau thành việc \"Checklist\".

### 2. XỬ LÝ \"GHOSTING\" (BỎ CON GIỮA CHỢ) - TIMEOUT LOGIC

**Vấn đề:**

-   Freelancer nhận cọc xong\... im lặng 2 tuần (Ghosting).

-   Freelancer làm xong, nộp bài, Client\... im lặng không vào duyệt để
    > quỵt tiền còn lại (hoặc câu giờ).

**Giải pháp:** **State Machine with Timeouts (Máy trạng thái có hẹn
giờ).** Mọi trạng thái trong hệ thống đều phải có \"Hạn sống\" (TTL -
Time To Live).

-   **Case 1: Freelancer lặn (Miss Deadline)**

    -   Hệ thống có Cron Job quét hàng ngày.

    -   Đến Deadline M1 mà chưa thấy nút \"Submit\" được bấm -\> Gửi
        > cảnh báo.

    -   Quá hạn 3 ngày -\> Hệ thống tự động kích hoạt trạng thái **\"Vi
        > phạm tiến độ\"**. Nút \"Hủy hợp đồng\" của Client sáng lên.
        > Client bấm -\> Lấy lại 100% tiền cọc.

-   **Case 2: Client lặn (Auto-Approval)**

    -   Freelancer đã Submit. Trạng thái là WAITING_APPROVAL.

    -   Hệ thống đếm ngược 7 ngày (hoặc 5 ngày tùy setup).

    -   Hết 7 ngày mà Client không bấm \"Duyệt\" cũng không bấm \"Yêu
        > cầu sửa\" -\> Hệ thống **Tự động Duyệt (Auto-approve)** -\>
        > Tiền chuyển về ví Freelancer.

    -   *(Luật: Im lặng đồng nghĩa với đồng ý).*

### 3. CHẤM ĐIỂM TÍN NHIỆM \"THỰC\" (REAL REPUTATION SCORE)

**Vấn đề:** Đánh giá 5 sao thường bị làm giả (seeding). Làm sao để phân
loại Broker/Freelancer dở hay giỏi *thực sự*? **Giải pháp:**
**Data-driven Metrics (Chấm điểm dựa trên dữ liệu hệ thống).**

Đừng chỉ cho user vote sao. Hãy để hệ thống tự chấm điểm ngầm:

-   **Điểm Broker:**

    -   *Tỷ lệ sửa Spec:* (Số lần Client bắt sửa Spec / Tổng số dự án).
        > Thấp = Broker hiểu ý tốt. Cao = Broker viết dở.

    -   *Tỷ lệ Dispute:* Dự án của Broker này hay bị kiện cáo không?

-   **Điểm Freelancer:**

    -   *On-time Delivery:* Tỷ lệ nộp bài đúng hạn (Dựa trên log thời
        > gian Submit vs Deadline).

    -   *Bug Rate:* Số lần Client bấm \"Reject/Request Change\" trên một
        > Milestone.

-   **Hiển thị:** \"Broker này có Tỷ lệ thành công 98%, Độ chính xác
    > Spec 4.8/5\". (Uy tín hơn hẳn 5 ngôi sao ảo).

### 4. QUY TRÌNH THAY NGƯỜI (HANDOVER PROTOCOL)

**Vấn đề:** Bạn có nhắc đến việc \"Freelancer cũ nghỉ, người mới vào\".
Nhưng người mới vào làm sao chạy được code cũ? **Giải pháp:** **The
\"Environment Docker\" Requirement.**

Để dự án không chết khi đổi người, Hợp đồng phải quy định chuẩn bàn giao
môi trường:

-   **Bắt buộc:** File README.md chuẩn và file docker-compose.yml (hoặc
    > hướng dẫn setup môi trường cực chi tiết).

-   **Checklist Bàn giao cuối:**

    -   Hệ thống yêu cầu Freelancer mới (hoặc Broker) test thử: \"Chạy
        > lệnh docker-compose up có lên web không?\".

    -   Nếu lên -\> Mới cho Freelancer cũ nhận tiền cuối cùng.

    -   Đây là \"Chìa khóa trao tay\". Không có chìa khóa này, tiền bị
        > khóa vĩnh viễn.
