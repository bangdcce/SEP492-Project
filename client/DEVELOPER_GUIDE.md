# InterDev Client - Developer Guide

Hướng dẫn cấu trúc folder và cách code chuẩn cho dự án InterDev Client.

---

## 📁 Folder Structure

```
src/
├── features/           # Feature modules (tách theo chức năng)
│   ├── auth/
│   │   ├── api.ts          # API calls
│   │   ├── types.ts        # TypeScript types
│   │   ├── hooks.ts        # Custom hooks
│   │   ├── context.tsx     # React context (nếu cần)
│   │   ├── components/     # Components riêng của feature
│   │   └── index.ts        # Barrel export
│   └── [feature-name]/
│
├── shared/             # Code dùng chung
│   ├── api/
│   │   └── client.ts       # Axios instance
│   ├── components/
│   │   ├── ui/             # Primitive components (Button, Input...)
│   │   └── layouts/        # Layout components
│   ├── hooks/              # Shared hooks (useDebounce, useLocalStorage)
│   ├── types/              # Shared types (ApiResponse, PaginatedResponse)
│   ├── utils/              # Utilities (formatters, validators)
│   └── index.ts
│
├── pages/              # Route pages (lazy loaded)
├── constants/          # App constants (ROUTES, STORAGE_KEYS)
├── App.tsx             # Router setup
├── main.tsx            # Entry point
└── index.css           # Global styles (Tailwind)
```

---

## 🔧 Quy tắc đặt tên

| Loại       | Convention                 | Ví dụ                           |
| ---------- | -------------------------- | ------------------------------- |
| Components | PascalCase                 | `LoginForm.tsx`, `Button.tsx`   |
| Hooks      | camelCase + prefix `use`   | `useAuth.ts`, `useAuditLogs.ts` |
| Types      | PascalCase                 | `User`, `AuditLog`              |
| Constants  | UPPER_SNAKE_CASE           | `API_CONFIG`, `ROUTES`          |
| Files      | kebab-case hoặc PascalCase | `api.ts`, `LoginForm.tsx`       |
| Folders    | kebab-case                 | `audit-logs/`, `shared/`        |

---

## 📝 Tạo Feature mới

### Bước 1: Tạo folder structure

```
src/features/projects/
├── api.ts
├── types.ts
├── hooks.ts
├── components/
│   └── index.ts
└── index.ts
```

### Bước 2: Định nghĩa Types (`types.ts`)

```typescript
export interface Project {
  id: number;
  name: string;
  description: string;
  status: "draft" | "active" | "completed";
  createdAt: string;
}

export interface ProjectFilters {
  page?: number;
  limit?: number;
  status?: string;
}
```

### Bước 3: Tạo API service (`api.ts`)

```typescript
import { apiClient } from "@/shared/api/client";
import type { Project, ProjectFilters } from "./types";
import type { PaginatedResponse } from "@/shared/types";

const ENDPOINTS = {
  BASE: "/projects",
  BY_ID: (id: number) => `/projects/${id}`,
};

export const projectsApi = {
  getAll: (filters?: ProjectFilters, signal?: AbortSignal) =>
    apiClient.get<PaginatedResponse<Project>>(ENDPOINTS.BASE, {
      params: filters,
      signal,
    }),

  getById: (id: number, signal?: AbortSignal) =>
    apiClient.get<Project>(ENDPOINTS.BY_ID(id), { signal }),

  create: (data: Partial<Project>) =>
    apiClient.post<Project>(ENDPOINTS.BASE, data),

  update: (id: number, data: Partial<Project>) =>
    apiClient.put<Project>(ENDPOINTS.BY_ID(id), data),

  delete: (id: number) => apiClient.delete<void>(ENDPOINTS.BY_ID(id)),
};
```

### Bước 4: Tạo Hooks (`hooks.ts`)

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import { projectsApi } from "./api";
import type { Project, ProjectFilters } from "./types";

export function useProjects(initialFilters?: ProjectFilters) {
  const [data, setData] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState(
    initialFilters || { page: 1, limit: 20 }
  );
  const isMounted = useRef(true);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const response = await projectsApi.getAll(filters, signal);
        if (isMounted.current) setData(response.data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (isMounted.current) setError(err as Error);
      } finally {
        if (isMounted.current) setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    isMounted.current = true;
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => {
      isMounted.current = false;
      controller.abort();
    };
  }, [fetchData]);

  return { data, loading, error, setFilters, refresh: fetchData };
}
```

### Bước 5: Export từ index.ts

```typescript
export * from "./types";
export * from "./api";
export * from "./hooks";
export * from "./components";
```

---

## 🎨 Tạo Component

### UI Component (shared)

```typescript
// src/shared/components/ui/Badge.tsx
interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  const variants = {
    default: "bg-primary/10 text-primary",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    danger: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
```

### Feature Component

```typescript
// src/features/projects/components/ProjectCard.tsx
import { Card, Button, Badge } from "@/shared/components/ui";
import type { Project } from "../types";

interface ProjectCardProps {
  project: Project;
  onEdit: (id: number) => void;
}

export function ProjectCard({ project, onEdit }: ProjectCardProps) {
  return (
    <Card>
      <h3 className="font-semibold">{project.name}</h3>
      <Badge variant={project.status === "active" ? "success" : "default"}>
        {project.status}
      </Badge>
      <Button onClick={() => onEdit(project.id)}>Chỉnh sửa</Button>
    </Card>
  );
}
```

---

## 📄 Tạo Page mới

```typescript
// src/pages/ProjectsPage.tsx
import { DashboardLayout } from "@/shared/components/layouts";
import { useProjects } from "@/features/projects";
import { ProjectCard } from "@/features/projects/components";

export default function ProjectsPage() {
  const { data, loading } = useProjects();

  return (
    <DashboardLayout title="Dự án" description="Quản lý các dự án của bạn">
      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {data.map((p) => (
            <ProjectCard key={p.id} project={p} onEdit={console.log} />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
```

**Thêm route vào App.tsx:**

```typescript
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage"));

// Trong Routes
<Route
  path="/projects"
  element={
    <ProtectedRoute>
      <MainLayout>
        <ProjectsPage />
      </MainLayout>
    </ProtectedRoute>
  }
/>;
```

---

## ✅ Checklist khi code

- [ ] Types được định nghĩa trước khi code
- [ ] API methods có hỗ trợ `AbortSignal`
- [ ] Hooks sử dụng `useRef` để track mounted state
- [ ] Components sử dụng Tailwind classes từ design system
- [ ] Exports từ `index.ts` được cập nhật
- [ ] Page mới được thêm vào `App.tsx`

---

## 🔗 Path Aliases

```typescript
// Thay vì
import { Button } from "../../../shared/components/ui";

// Sử dụng
import { Button } from "@/shared/components/ui";
```

**Cấu hình trong `tsconfig.app.json` và `vite.config.ts`:**

```json
// tsconfig.app.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## 📚 Import Order

```typescript
// 1. React/external libraries
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// 2. Shared modules
import { Button, Card } from "@/shared/components/ui";
import { formatDate } from "@/shared/utils";

// 3. Feature modules
import { useAuth } from "@/features/auth";

// 4. Local imports
import { ProjectCard } from "./components";
import type { Project } from "./types";
```
