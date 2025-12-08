# 🔐 Cách Lấy Supabase URL và ANON KEY

## 📋 Các Bước Chi Tiết

### **Bước 1: Đăng Nhập Vào Supabase**
1. Truy cập: https://supabase.com
2. Nhấp **"Sign In"** hoặc **"Create new project"**
3. Đăng nhập bằng GitHub hoặc Email

### **Bước 2: Tạo Project Mới (Nếu Chưa Có)**
1. Nhấp **"New Project"**
2. Chọn **Organization** (hoặc tạo mới)
3. Nhập **Project Name**: `interdev` (hoặc tên bạn muốn)
4. Đặt **Database Password**: ghi nhớ password này
5. Chọn **Region**: Gần vị trí bạn nhất (ví dụ: Singapore, Tokyo)
6. Nhấp **"Create new project"**
7. Chờ ~2 phút cho project khởi tạo

### **Bước 3: Lấy VITE_SUPABASE_URL**

#### Cách 1: Qua Dashboard
```
1. Dashboard → Click vào project của bạn
2. Nhìn vào URL hiện tại
   VD: https://xxxxxxxxxxxx.supabase.co
3. Đó chính là VITE_SUPABASE_URL
```

#### Cách 2: Qua Project Settings
```
1. Nhấp icon ⚙️ (Settings) ở góc dưới trái
2. Chọn "API"
3. Nhìn mục "Project URL" → Copy URL đó
   VD: https://ijrxvfakxyzabcdef.supabase.co
```

### **Bước 4: Lấy VITE_SUPABASE_ANON_KEY**

#### Vào API Settings:
```
1. ⚙️ Settings → API
2. Nhìn mục "anon" (public)
3. Copy key dưới "anon public key"
   VD: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🎯 Visual Guide

```
Supabase Dashboard
├─ Bạn ở đây (Home)
│  └─ URL có dạng: https://xxxxxxxxxxxx.supabase.co
│
└─ ⚙️ Settings (góc dưới trái)
   └─ API
      ├─ Project URL ← Copy đây (VITE_SUPABASE_URL)
      │
      └─ anon public key ← Copy đây (VITE_SUPABASE_ANON_KEY)
```

---

## 📝 Ví Dụ Thực Tế

Nếu Dashboard của bạn hiển thị:
```
Project URL: https://ijrxvfakxyzabcdef.supabase.co
anon key:    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqcnh2ZmFr...
```

Thì file `.env` của bạn sẽ là:
```env
VITE_SUPABASE_URL=https://ijrxvfakxyzabcdef.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqcnh2ZmFr...
```

---

## ⚠️ Lưu Ý Quan Trọng

### ✅ CÓ THỂ chia sẻ:
- ✅ `VITE_SUPABASE_URL` (Project URL) - **Public, không sao**
- ✅ `VITE_SUPABASE_ANON_KEY` (anon public key) - **Public, không sao**
- ✅ Dùng trong `.env` của frontend (React)

### ❌ KHÔNG được chia sẻ:
- ❌ `service_role` key (Backend only)
- ❌ Database password
- ❌ API key cho Admin/Service

---

## 🚀 Sau Khi Có URL và KEY

### Cập nhật `.env` của frontend:
```bash
# client/.env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://ijrxvfakxyzabcdef.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Hoặc nếu dùng Docker PostgreSQL:
```bash
# Bỏ qua Supabase, dùng docker-compose.yml thay vì
VITE_API_URL=http://localhost:3000
# Không cần SUPABASE_URL và ANON_KEY
```

---

## 🔍 Troubleshooting

### "Không tìm thấy nút Settings?"
→ Nhìn góc **dưới bên trái** dashboard, tìm biểu tượng ⚙️

### "API tab không có?"
→ Vào **Settings** rồi chọn tab **API** ở bên cạnh

### "anon key đâu?"
→ Scroll xuống trong tab **API**, mục "anon public key" nằm dưới "Project URL"

### "Key quá dài, có phải là đúng không?"
→ ✅ Đúng! JWT keys rất dài (100-200+ ký tự)

---

## 📚 Tài Liệu Supabase

- Supabase Docs: https://supabase.com/docs
- API Reference: https://supabase.com/docs/reference/javascript
- Getting Started: https://supabase.com/docs/guides/getting-started

---

## ✨ Bước Tiếp Theo

1. ✅ Lấy `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`
2. 📝 Cập nhật vào `client/.env`
3. 🚀 Chạy: `yarn dev` trong client folder
4. 🧪 Test kết nối với Supabase

---

**Có câu hỏi? Hãy kiểm tra Supabase Dashboard của bạn!** 🎉
