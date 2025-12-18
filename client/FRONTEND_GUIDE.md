# Frontend Developer Guide - React + Vite ⚛️

Hướng dẫn nhanh cho developer làm việc với Frontend (React + TypeScript + TailwindCSS).

---

## Quick Start

```bash
cd client
yarn install
yarn dev         # Development mode (localhost:5173)
yarn build       # Production build
```

---

## Cấu trúc Feature

```
src/features/[feature-name]/
├── [FeatureName]Page.tsx     # Main feature component
├── api.ts                    # API calls
├── types.ts                  # TypeScript types
└── components/               # Feature-specific components
    ├── [Component1].tsx
    └── [Component2].tsx
```

---

## Tạo Feature mới (Step-by-step)

### 1. Định nghĩa Types

```typescript
// src/features/projects/types.ts

export type ProjectStatus = "PLANNING" | "IN_PROGRESS" | "COMPLETED";

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  ownerId: string;
  createdAt: string;
}

export interface ProjectFilters {
  search?: string;
  status?: ProjectStatus | "ALL";
}
```

---

### 2. Tạo API Service

```typescript
// src/features/projects/api.ts
import { apiClient } from "@/shared/api/client";
import type { Project } from "./types";

export interface GetProjectsParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface ProjectsResponse {
  data: Project[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const ENDPOINTS = {
  PROJECTS: "/projects",
};

export const projectsApi = {
  getAll: (params?: GetProjectsParams) =>
    apiClient.get<ProjectsResponse>(ENDPOINTS.PROJECTS, { params }),

  getById: (id: string) =>
    apiClient.get<Project>(`${ENDPOINTS.PROJECTS}/${id}`),

  create: (data: Partial<Project>) =>
    apiClient.post<Project>(ENDPOINTS.PROJECTS, data),

  update: (id: string, data: Partial<Project>) =>
    apiClient.put<Project>(`${ENDPOINTS.PROJECTS}/${id}`, data),

  delete: (id: string) => apiClient.delete(`${ENDPOINTS.PROJECTS}/${id}`),
};
```

---

### 3. Tạo Main Feature Component

```tsx
// src/features/projects/ProjectsPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { projectsApi } from "./api";
import type { Project, ProjectFilters } from "./types";
import { ProjectCard } from "./components/ProjectCard";

export const ProjectsPage: React.FC = () => {
  // ========== STATE ==========
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const [filters, setFilters] = useState<ProjectFilters>({
    search: "",
    status: "ALL",
  });

  // ========== FETCH DATA ==========
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search || undefined,
        status: filters.status !== "ALL" ? filters.status : undefined,
      };

      const response = await projectsApi.getAll(params);

      setProjects(response.data);
      setPagination((prev) => ({
        ...prev,
        total: response.meta.total,
        totalPages: response.meta.totalPages,
      }));
    } catch (err: any) {
      console.error("Failed to fetch projects:", err);
      setError(err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Reset page khi filter thay đổi
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [filters.search, filters.status]);

  // ========== HANDLERS ==========
  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  // ========== RENDER ==========
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your projects</p>
        </div>
        <button className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600">
          Create Project
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <input
          type="text"
          placeholder="Search projects..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          <span className="ml-2 text-gray-600">Loading...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchProjects}
            className="mt-2 text-red-700 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
```

---

### 4. Tạo Sub-components

```tsx
// src/features/projects/components/ProjectCard.tsx
import React from "react";
import type { Project } from "../types";

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onClick,
}) => {
  const statusColors = {
    PLANNING: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-green-100 text-green-800",
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <h3 className="font-semibold text-slate-900">{project.name}</h3>
      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
        {project.description || "No description"}
      </p>
      <div className="mt-3">
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            statusColors[project.status]
          }`}
        >
          {project.status}
        </span>
      </div>
    </div>
  );
};
```

---

### 5. Tạo Page Wrapper

```tsx
// src/pages/ProjectsPage.tsx
import { ProjectsPage } from "@/features/projects/ProjectsPage";

export default function ProjectsPageWrapper() {
  return <ProjectsPage />;
}
```

---

### 6. Thêm Route

```tsx
// src/App.tsx
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage"));

// Trong Routes:
<Route
  path="/projects"
  element={
    <MainLayout>
      <ProjectsPage />
    </MainLayout>
  }
/>;
```

---

### 7. Thêm vào Sidebar (nếu cần)

```typescript
// src/shared/components/layouts/sidebarConfig.ts
import { FolderOpen } from "lucide-react";

export const sidebarMenuItems: SidebarMenuItem[] = [
  // ... existing items
  {
    id: "projects",
    label: "Projects",
    icon: FolderOpen,
    path: "/projects",
  },
];
```

---

## Component Patterns

### Modal Component

```tsx
// src/features/[feature]/components/[Name]Modal.tsx
import React from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()} // Prevent close on content click
      >
        {children}
      </div>
    </div>
  );
};
```

### Table Component

```tsx
// Pattern cho data table
interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
}
```

---

## Utility Functions

### cn() - Merge classNames

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage
<div
  className={cn(
    "base-class",
    isActive && "active-class",
    variant === "primary" && "primary-class"
  )}
/>;
```

---

## Import Patterns

### Type-only imports

```typescript
// Khi chỉ dùng cho type (không phải value)
import type { Project, ProjectFilters } from "./types";

// Mixed import
import { projectsApi } from "./api";
import type { ProjectsResponse } from "./api";
```

### Path aliases

```typescript
// Configured in tsconfig.json
import { apiClient } from "@/shared/api/client";
import { Button } from "@/shared/components/custom/Button";
import { ROUTES } from "@/constants";
```

---

## State Management Patterns

### Pagination + Filters

```typescript
const [pagination, setPagination] = useState({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
});

const [filters, setFilters] = useState({
  search: "",
  status: "ALL",
});

// Reset page khi filter thay đổi
useEffect(() => {
  setPagination((prev) => ({ ...prev, page: 1 }));
}, [filters.search, filters.status]);
```

### Loading + Error states

```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

try {
  setLoading(true);
  setError(null);
  // ... fetch
} catch (err: any) {
  setError(err.message || "Something went wrong");
} finally {
  setLoading(false);
}
```

---

## Checklist khi tạo feature mới

- [ ] Types định nghĩa đầy đủ
- [ ] API service với typed responses
- [ ] Main page component với loading/error states
- [ ] Sub-components với proper props
- [ ] Page wrapper trong `/pages`
- [ ] Route added trong `App.tsx`
- [ ] Sidebar entry (nếu cần)
- [ ] Test trên browser

---

## Common Mistakes to Avoid

1. ❌ Forgot `import type` for types
2. ❌ Missing loading/error states
3. ❌ Not handling empty data
4. ❌ Using `any` type
5. ❌ Forgot to add route
6. ❌ Missing `key` prop in lists

---

_Tài liệu được tạo: 2024-12-18_
