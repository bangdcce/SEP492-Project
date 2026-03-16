# InterDev - Prompt Ky Thuat Chuan De Giao Coding Agent

## Cach dung nhanh

- Copy toan bo prompt o phan "Prompt Hoan Chinh" ben duoi.
- Dan vao Claude Code/GPT coding agent.
- Doi noi dung [THAY_THE] theo moi truong thuc te truoc khi chay.

## Prompt Hoan Chinh

Ban dong vai tro la Principal Engineer + Product-minded Architect cho du an InterDev.
Muc tieu: sua bug, hoan thien luong nghiep vu, nang cap UI/UX, dam bao data integrity, va bo sung tinh nang dispute/hearing theo yeu cau ben duoi. Hay thuc hien theo huong "production-ready", co migration an toan, test day du, va tai lieu hoa ro rang.

### 1) Thong tin he thong

- Monorepo: client (frontend) + server (backend).
- Cac role chinh: admin, staff, client, broker, freelancer.
- Domain can tap trung: dispute, hearing, scheduling, contract detail, review sau nghiem thu, profile/trust score, audit/export logs, staff dashboard statistics.

### 2) Van de can giai quyet (bat buoc)

1. Hearing dispute cu da co verdict nhung van hien thi trong tab hearing dang hoat dong.
2. Chua co khu vuc dispute history rieng cho:

- staff/admin (tong quan vu an da giai quyet, phuc vu khieu nai ve sau).
- user-side (client/broker/freelancer) de theo doi vu viec cu.

3. Chuc nang xem chi tiet contract trong hearing/dispute chua hoat dong.
4. Chuc nang tao cuoc hop meet dang loi.
5. Luong report dispute va appeal dispute chua co UI day du cho client/broker/freelancer.
6. Appeal/dispute can duoc route toi role admin/staff de xu ly theo quy trinh.
7. Luong staff moi them staff khac/admin vao vu an phuc tap chua hoat dong.
8. Can cai thien UI/UX dispute tong the (de hieu, de thao tac, de tim kiem).
9. Chuc nang review lan nhau (broker/freelancer/client) sau khi project nghiem thu chua dua vao van hanh on dinh.
10. Chua co preview/profile/trustscore du an da lam khi moi thanh vien vao du an.
11. Export log dispute chua dat muc chuyen nghiep va thieu yeu to phap ly can thiet de doi chieu tranh chap.
12. Can tang do toan ven du lieu, kho bi chinh sua trai phep (auditability/tamper resistance).
13. Chua co bo statistics hop ly cho staff dashboard.
14. Mark busy/set available giua role chua dong bo, UI kho hieu, chua gan ket tot voi autoschedule.
15. Lich cua client/broker/freelancer can sua UI/UX va logic de ro nghia va de thao tac.
16. De xuat lich can co rang buoc xac nhan tranh bam nham; qua mot nguong thoi gian thi khong duoc doi lich.
17. Auto-schedule can nang cap de xu ly rang buoc phuc tap.
18. Can bo sung cum tab dispute cho admin de xu ly appeal nhanh.
19. Audit log can tong quan hon, “xinh”, va export log chuyen nghiep hon.
20. Doi title va icon tab trinh duyet thanh logo + ten du an InterDev.

### 3) Muc tieu ket qua

- Hoan thien luong dispute lifecycle end-to-end: report -> triage -> hearing -> verdict -> archive/history -> appeal (neu co).
- Tach bach Active Hearings va Archived/Resolved Hearings.
- Cung cap dispute library/search cho ca noi bo (staff/admin) va ben ngoai (client/broker/freelancer) theo quyen.
- Dung contract detail viewer o moi diem lien quan (hearing/dispute/detail pages).
- Meet scheduling hoat dong on dinh, retry/fallback ro rang.
- Busy/available + lich role duoc dong bo voi autoschedule.
- Audit/export logs dat chuan truy vet va ro toan bo chain of events.

### 4) Yeu cau ky thuat bat buoc

- Kien truc:
- Khong pha vo API contract dang dung neu khong can thiet.
- Neu can thay doi schema thi phai co migration, backfill, rollback plan.
- Chia nho PR logic: backend domain, frontend UX, scheduling, audit/export.

- Du lieu va toan ven:
- Them co che immutable event trail cho dispute/hearing status transitions.
- Luu actor, role, timestamp, old/new values, reason, source.
- Khuyen nghi hash chain hoac signing cho cac ban ghi log quan trong.
- Export phai co checksum/file signature metadata de doi chieu.

- Phan quyen:
- RBAC ro rang cho admin/staff/client/broker/freelancer.
- Staff/admin xem duoc kho du lieu archive sau verdict.
- User chi xem cac dispute cua ho.

- Search va UI archive:
- Filter theo ma vu viec, project, role, trang thai, moc thoi gian, verdict type.
- Full-text search cho tom tat, ly do tranh chap, keyword bang chung.
- UI danh dau ro: Active, In Review, Verdict Issued, Archived, Appealed.

- Scheduling:
- Co trang thai availability theo ngay/gio + timezone.
- Autoschedule ton trong occupied slots, SLA, escalation priority.
- Co confirm step 2 buoc khi chap nhan lich.
- Rule freeze-change: qua [THAY_THE_SO_GIO]h truoc hearing thi khong cho request doi lich (tru exception policy).

- Meet integration:
- Sua create meet flow, them retry + idempotency key + error mapping de user hieu duoc.

- Review sau nghiem thu:
- Kich hoat luong review 2 chieu sau milestone/project completion.
- Chong spam va duplicate review.

- Profile/trustscore:
- Hien thi thong tin hoat dong du an, trust metrics, lich su hop tac lien quan.
- Co trang preview profile khi moi vao du an.

- Browser branding:
- Doi title app thanh "InterDev".
- Doi favicon/logo tab theo asset chinh thuc du an.

### 5) Yeu cau phap ly va compliance (huong Vietnam)

- Khong tu khang dinh “du dieu kien phap ly de nop toa” neu chua duoc luat su xac nhan.
- Thay vao do, xay bo "evidence package" co cau truc:
- Contract snapshot + phien ban + timestamp.
- Lich su chat lien quan tranh chap (co metadata).
- Timeline su kien dispute/hearing/verdict/appeal.
- Danh muc tep bang chung + hash checksum.
- Audit log truy vet thao tac.
- Co disclaimer phap ly trong UI/export: can doi chieu va xac nhan boi bo phan phap che.

### 6) De xuat statistics cho staff dashboard

Bat buoc co cac nhom KPI:

1. Throughput: so dispute moi, dang xu ly, da dong theo ngay/tuan/thang.
2. SLA: median time-to-first-response, time-to-verdict, breach rate.
3. Scheduling: ti le auto-schedule thanh cong, so lan reschedule, no-show rate.
4. Quality: ti le appeal, ti le verdict bi lat, feedback score.
5. Workload: so vu/staff, utilization %, pending queue theo muc do uu tien.
6. Risk signals: vu viec keo dai qua nguong, vu co nhieu ben tham gia, vu co bang chung mau thuan.

### 7) Dau ra bat buoc cua ban

1. Khao sat codebase va viet implementation plan theo module.
2. Liet ke file can sua/tao (frontend/backend/db/tests/docs).
3. Thuc hien code thay doi day du.
4. Tao migration + seed/backfill neu can.
5. Viet test:

- Unit tests cho business logic.
- Integration/API tests cho dispute lifecycle.
- E2E tests cho UI critical flows.

6. Cap nhat tai lieu ky thuat + changelog.
7. Dua checklist nghiem thu voi ket qua pass/fail.

### 8) Tieu chi nghiem thu (DoD)

- Active hearing khong con hien cac vu da verdict.
- Co 2 khong gian history ro rang:
- Internal archive (staff/admin).
- User history (client/broker/freelancer).
- Contract detail viewer hoat dong o moi diem truy cap chinh.
- Create meet khong con loi nghiem trong; co thong bao loi de hieu.
- Report/appeal dispute co UI day du, route dung role xu ly.
- Staff co the invite staff/admin ho tro trong vu phuc tap.
- Review sau completion chay duoc end-to-end.
- Profile/trustscore preview hien thi dung va de dung.
- Audit log + export log co cau truc, de tim, de doi chieu.
- Busy/available + autoschedule + freeze-change rule hoat dong dung.
- Admin dispute tabs hoat dong ro nghia vu xu ly.
- Browser title/favicon doi thanh InterDev.

### 9) Cach tra loi cua ban (agent)

- Bat dau bang danh sach assumptions + rui ro.
- Sau do dua implementation plan theo thu tu uu tien.
- Khi code xong, dua:
- Danh sach file da doi.
- Tom tat thay doi theo module.
- Danh sach test da chay va ket qua.
- Cac han che chua xu ly duoc + de xuat tiep theo.

### 10) Rang buoc chat luong

- Code de doc, typed ro rang, khong duplicate logic.
- Khong hardcode role/enum neu da co constants.
- Co observability (log level, tracing context) cho luong critical.
- Khong commit secrets.
- Neu can env moi thi cap nhat file env.example + docs.

## Cau hinh MCP GitHub token (an toan)

Khong hardcode PAT trong source code hoac file commit len git.
Su dung bien moi truong local:

- Windows PowerShell (user scope):

```powershell
setx GITHUB_TOKEN "<YOUR_GITHUB_PAT>"
```

- VS Code settings cho MCP (vi du):

```json
{
  "mcp.github.token": "${env:GITHUB_TOKEN}"
}
```

Kiem tra lai bang cach restart VS Code sau khi set env.

## Ghi chu

- Neu can, co the tach prompt tren thanh 3 phase: Phase 1 (fix bug critical), Phase 2 (UX + scheduling), Phase 3 (audit/export + legal packaging).
- Khuyen nghi yeu cau agent tao PR nho theo module de review de hon.
