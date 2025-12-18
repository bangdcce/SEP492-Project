# 📁 Cấu trúc Thư mục Frontend

## Tổng quan

```
src/
├── pages/           ← Route Pages (entry point cho mỗi route)
├── features/        ← Feature Modules (business logic)
├── shared/          ← Shared Resources (dùng chung)
├── contexts/        ← Global Contexts
├── constants/       ← Constants & Configs
└── assets/          ← Static Assets
```

---

## 1. `pages/` - Route Pages

**Mục đích:** Điểm vào cho mỗi route, kết hợp Layout + Feature

| Quy tắc    |                                 |
| ---------- | ------------------------------- |
| Đặt tên    | `[Tên]Page.tsx` (PascalCase)    |
| Chứa       | Layout wrapper + Feature import |
| KHÔNG chứa | Business logic, API calls       |

**Ví dụ:**

```tsx
// pages/LoginPage.tsx
import { AuthLayout } from "@/shared/components/layouts";
import { LoginForm } from "@/features/auth";

export default function LoginPage() {
  return (
    <AuthLayout title="Đăng nhập">
      <LoginForm />
    </AuthLayout>
  );
}
```

---

## 2. `features/` - Feature Modules

**Mục đích:** Chứa toàn bộ logic của từng tính năng

**Cấu trúc:**

```
features/[feature-name]/
├── index.ts           ← Public exports
├── components/        ← UI components
├── hooks/             ← Custom hooks
├── api.ts             ← API calls
├── types.ts           ← TypeScript types
└── utils.ts           ← Helpers
```

**Ví dụ `features/auth/`:**

```
features/auth/
├── index.ts              ← export { LoginForm, useAuth }
├── components/
│   └── LoginForm.tsx
├── hooks/
│   └── useAuth.ts
├── api.ts
└── types.ts
```

---

## 3. `shared/` - Shared Resources

**Mục đích:** Code dùng chung giữa nhiều features

```
shared/
├── components/
│   ├── ui/              ← shadcn primitives (button.tsx)
│   ├── custom/          ← Custom components (Button.tsx)
│   └── layouts/         ← Layouts (MainLayout.tsx)
├── hooks/               ← Shared hooks
├── utils/               ← Utilities
├── types/               ← Shared types
└── api/                 ← API client
```

**Phân biệt `ui/` vs `custom/`:**

| Folder    | Loại                    | Ví dụ                    |
| --------- | ----------------------- | ------------------------ |
| `ui/`     | shadcn/Radix primitives | `button.tsx`, `card.tsx` |
| `custom/` | Tự viết                 | `Button.tsx`, `Logo.tsx` |

---

## 4. Import Alias

Dùng `@/` thay relative paths:

```tsx
// ✅ Đúng
import { Button } from "@/shared/components/ui/button";

// ❌ Sai
import { Button } from "../../../shared/components/ui/button";
```

---

## 5. Tóm tắt nhanh

| Loại code     | Đặt ở                        |
| ------------- | ---------------------------- |
| Route entry   | `pages/`                     |
| Feature logic | `features/[name]/`           |
| shadcn UI     | `shared/components/ui/`      |
| Custom shared | `shared/components/custom/`  |
| Layouts       | `shared/components/layouts/` |
| Shared hooks  | `shared/hooks/`              |
| API client    | `shared/api/`                |
| Constants     | `constants/`                 |
