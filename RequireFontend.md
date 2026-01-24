Bạn có thể bổ sung promt AI figma make code fontend cho tôi theo từng phase được không , promt sao mà lấy được hết các cái cần thiết của chức năng dispute và calender á . Kiểu trang web của tôi á là cái project bạn coi kỹ trong code là nó sẽ được chia theo từng milestone rồi các milestone đó là sẽ có nút disputes bấm nút dispute thì cái form nhập liệu dispute sẽ hiện ra nó là các trường nhập liệu trong logic code của backend, nó cần phải có được lấy được là id của người dùng , id của project , id của milestone rồi các bên liên quan kiểu muốn kiện ai , rồi lấy các cái spec, contract liên quan vào cái dispute á ,cái này là tự động dưới backend, còn cái form nhập reason của người dùng là cái form mà kiểu có mấy cái lựa chọn phổ biến với cái other để nhập thủ công , ngoài ra là nộp bằng chưng, cấu hình whitelist bằng chứng để dưới backend lấy lên để cho fontend biết. Rồi sau khi người dùng phát động diputes thì họ cũng cần có cái giao diện như nào để kiện đa người dùng, giống với khả năng code dưới backend đã cho phép thực hiện .Rồi xong người dùng có thể nộp bằng chứng bao gồm các file whites nhớ là có cái logic quét virus ở dưới backend (server) rồi xong thì người staff sẽ nhận được đơn trên trang của mình rồi trang của staff kiểu chia ra á , là client ,broker, freelancer, admin,staff là có trang riêng dashboard riêng đồ á . Thì thiết kế font end làm sao mà staff có chỗ nhận đơn dispute, nhận xong thì họ xem xét , coi các bằng chứng, lý do kiểu check trước coi bằng chứng hay đơn này có nghiêm túc hay spam nếu spam thì họ có thể reject nhưng mà reject phải hợp lý vì người dùng cảm thấy nếu đơn reject đó là không công bằng thì họ có thể kháng cáo đơn đó thì đơn đó sẽ gửi thẳng tới admin. RỒi nếu staff duyệt đơn thì hệ thống sẽ tạo ra một cái lịch hợp gọi là cái phòng họp live chat lên lịch tự động. À mà tôi cần thêm 1 trang kiểu để kiểu mọi người dùng có thể biết lịch trình của mình á kiểu nó sẽ đánh dấu các bagde vào các ngày cho họ biết lịch của mình như nào, hệ thống sẽ hiển thị buổi họp như thế, ngoài ra thì họ còn có thể cho hệ thống biết ngày đó của mình có rảnh không hay bận để hệ thống sắp xếp kiểu thêm ngày bận vào á. Rồi có cái chỗ để người dùng có thể dời lịch nếu như có bận đột xuất , dời lịch tòa dispute á kiểu nói chung là họ phải cung cấp đủ các lý do theo server yêu cầu để xếp lịch. RỒi khi tới sát giờ họp thì họ cần phải có phải có cái gì đó thông báo để hoặc chỗ nào đó để click để họ tham gia vào phòng tòa live chat, thì cái phòng tòa này chủ phục vụ chat , nhưng nó phải cung cấp toàn bộ các tài liệu liên quan tới dự án và vụ kiện để phán xử , tòa cần phải tuân theo các quy luật trong code backend và phục vụ các chức năng của backend (phần này bạn đọc kỹ backend để code fontend chuẩn chỉnh nhé,kiểu hơi nhiều chức năng bạn cần phải đọc và code cho fontend phục vụ nó). RỒi sau khi họp xong thì cần phải có nút để phán quyết nếu staff đã có quyết định và phù hợp, kiểu trong backend có thiết kế á.Nếu cuộc họp quá phức tạp thì tổ chức nếu phiên họp để giải quyết. Rồi còn có phần hòa giải nếu 1 trong 2 bên muốn hòa giải (Cái này đã có logic backend), ngoài ra thì còn phần fontend cho bổ sung bằng chứng,rồi ẩn bằng chứng nếu user gửi lộn nhạy cảm, rồi chữ ký số .Rồi cả phần cho các phiên họp kháng cáo , mấy cái này bạn đọc kỹ toàn bộ logic của dispute, và calender dưới server để lấy thông tin chi tiết nhất rồi promt chi tiết thông tin của backend để figma make code fontend phù hợp cho tôi, nó phải đảm bảo sự hợp lý logic của backend và sự thoải mái tiện lợi UI,UX của fontend nói chung là bạn chi phase các cái phần và miêu tả kỹ promt đẻ nó code cho chuẩn .# INTERDEV PROJECT CONTEXT & DESIGN SYSTEM

You are a Senior Frontend Architect working on the "InterDev" project (Freelance Brokerage Platform).
All code generated must strictly follow these design and architecture rules to ensure consistency with the existing codebase.

## 1. DESIGN SYSTEM & UI RULES (Strict Compliance)

### Color Palette (Navy & Teal Theme)

- **Primary / Brand (Dark):** Navy Blue
- Usage: Headings, Sidebar Text, Primary Text.
- Tailwind: `text-slate-900`, `bg-slate-900`.
- **Accent / Action (Growth):** Teal / Cyan
- Usage: Primary Buttons, Active Sidebar Links, Badges, Links.
- Tailwind: `text-teal-600`, `bg-teal-600`, `bg-teal-50` (for light backgrounds/hover), `border-teal-200`.
- **Backgrounds:**
- **Sidebar:** Pure White (`bg-white`) + Light Border (`border-gray-200`).
- **Main Content Area:** Light Gray (`bg-gray-50` or `bg-slate-50`).
- **Cards/Modals:** White (`bg-white`) + Shadow (`shadow-sm`).
- **Feedback:**
- **Error/Dispute:** Red (`text-red-600`, `bg-red-50`).
- **Warning:** Orange/Amber.

### Typography & Spacing

- **Font:** Default Sans (Inter/Geist - via Tailwind default).
- **Border Radius:** `rounded-lg` (Standard) or `rounded-md` (Small inputs). Avoid `rounded-none` or `rounded-3xl`.
- **Shadows:** `shadow-sm` (Cards), `shadow-md` (Dropdowns/Modals).
- **Spacing:** Standard Tailwind spacing (p-4, p-6, gap-4).

### Layout Structure (DashboardLayout)

- **Sidebar:** Fixed Left, width `w-64` (256px), collapsible on mobile.
- Active Item Style: `bg-teal-50 text-teal-600 font-medium border-r-4 border-teal-500`.
- Inactive Item Style: `text-gray-700 hover:bg-gray-100`.
- **Header:** Sticky Top, height `h-16` (64px), White background, contains Breadcrumbs and User Profile.
- **Main Content:** Padded container (`p-6`), max-width constrained for readability usually `max-w-7xl`.

## 2. TECH STACK

- **Framework:** React (Vite) + TypeScript.
- **Styling:** TailwindCSS (Utility-first).
- **Icons:** `lucide-react` (ONLY).
- **Components:** ShadCN UI based patterns (HeadlessUI/Radix primitives).
- **Routing:** `react-router` (NOT react-router-dom directly, use the simplified router pattern).

## 3. ARCHITECTURE (Feature-based)

- Do NOT put everything in `/components`.
- Use: `src/features/[feature-name]/components` for business logic components.
- Use: `src/components/ui` for generic atoms (Button, Input, Card).
- Use: `src/layouts` for structure.

## 4. CURRENT MODULE CONTEXT

- We are currently building the **Dispute Management System**.
- Key Entities: Projects, Milestones, Disputes (Reason, Category, Evidence).
- Backend Simulation: Uses `disputeApi` with mocked data or Supabase integration. Nhớ kêu nó đọc code theo các thông số này vì đây là phần fontend đã có trước đó cần khớp layout
