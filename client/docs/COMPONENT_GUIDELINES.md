# 🎨 Component Guidelines

## Phân loại Components

### 1. shadcn Primitives (`shared/components/ui/`)

- Dựa trên Radix UI
- Sử dụng `cva` (class-variance-authority)
- Import từ file `.tsx` viết thường

```tsx
// button.tsx - shadcn primitive
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva("...", {
  variants: {
    variant: { default: "...", destructive: "..." },
    size: { default: "...", sm: "...", lg: "..." },
  },
});

export function Button({ variant, size, ...props }) {
  return (
    <button className={cn(buttonVariants({ variant, size }))} {...props} />
  );
}
```

**Import:**

```tsx
import { Button } from "@/shared/components/ui/button";

<Button variant="destructive" size="sm">
  Delete
</Button>;
```

---

### 2. Custom Components (`shared/components/custom/`)

- Tự viết, không dùng Radix
- Styles cố định hoặc đơn giản
- Đặt tên PascalCase

```tsx
// Button.tsx - custom component
interface ButtonProps {
  variant?: "primary" | "secondary" | "outline";
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  children,
}) => {
  const styles = {
    primary: "bg-teal-500 text-white",
    secondary: "bg-slate-900 text-white",
    outline: "border border-gray-300",
  };

  return <button className={styles[variant]}>{children}</button>;
};
```

**Import:**

```tsx
import { Button } from "@/shared/components/custom/Button";
```

---

### 3. Feature Components (`features/[name]/components/`)

- Dùng riêng cho 1 feature
- KHÔNG export ra ngoài feature

```tsx
// features/auth/components/LoginForm.tsx
export function LoginForm() {
  // Form logic specific to auth
}
```

---

## Quy tắc đặt tên

| Loại    | Tên file         | Tên component |
| ------- | ---------------- | ------------- |
| shadcn  | `button.tsx`     | `Button`      |
| Custom  | `Button.tsx`     | `Button`      |
| Feature | `LoginForm.tsx`  | `LoginForm`   |
| Layout  | `MainLayout.tsx` | `MainLayout`  |

---

## Export Pattern

Mỗi folder có `index.ts` để export gọn:

```ts
// shared/components/ui/index.ts
export * from "./button";
export * from "./card";
export * from "./table";

// shared/components/index.ts
export * from "./ui";
export * from "./custom";
export * from "./layouts";
```

**Import:**

```tsx
import { Button, Card } from "@/shared/components/ui";
import { MainLayout } from "@/shared/components/layouts";
```
