# 🚀 Feature Development Guide

## Tạo Feature Mới

### Bước 1: Tạo thư mục feature

```
features/[feature-name]/
├── index.ts
├── components/
├── hooks/
├── api.ts
├── types.ts
└── utils.ts
```

### Bước 2: Định nghĩa types

```ts
// features/audit-logs/types.ts
export interface AuditLogEntry {
  id: string;
  actor: { name: string; email: string };
  action: "CREATE" | "UPDATE" | "DELETE";
  timestamp: string;
}

export interface AuditLogFilters {
  searchAction: string;
  dateFrom: string;
  dateTo: string;
}
```

### Bước 3: Tạo API functions

```ts
// features/audit-logs/api.ts
import { apiClient } from "@/shared/api/client";
import type { AuditLogEntry, AuditLogFilters } from "./types";

export async function fetchAuditLogs(filters: AuditLogFilters) {
  return apiClient.get<AuditLogEntry[]>("/audit-logs", { params: filters });
}
```

### Bước 4: Tạo hooks

```ts
// features/audit-logs/hooks/useAuditLogs.ts
import { useState, useEffect } from "react";
import { fetchAuditLogs } from "../api";
import type { AuditLogEntry, AuditLogFilters } from "../types";

export function useAuditLogs(filters: AuditLogFilters) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs(filters)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [filters]);

  return { logs, loading };
}
```

### Bước 5: Tạo components

```tsx
// features/audit-logs/components/AuditLogTable.tsx
import type { AuditLogEntry } from "../types";

interface Props {
  logs: AuditLogEntry[];
}

export function AuditLogTable({ logs }: Props) {
  return (
    <table>
      {logs.map((log) => (
        <tr key={log.id}>
          <td>{log.actor.name}</td>
          <td>{log.action}</td>
        </tr>
      ))}
    </table>
  );
}
```

### Bước 6: Tạo main page component

```tsx
// features/audit-logs/AuditLogPage.tsx
import { useState } from "react";
import { useAuditLogs } from "./hooks/useAuditLogs";
import { AuditLogTable } from "./components/AuditLogTable";
import { AuditLogFilters } from "./components/AuditLogFilters";

export function AuditLogPage() {
  const [filters, setFilters] = useState({ ... });
  const { logs, loading } = useAuditLogs(filters);

  return (
    <div>
      <AuditLogFilters filters={filters} onChange={setFilters} />
      <AuditLogTable logs={logs} />
    </div>
  );
}
```

### Bước 7: Export public API

```ts
// features/audit-logs/index.ts
export { AuditLogPage } from "./AuditLogPage";
export { useAuditLogs } from "./hooks/useAuditLogs";
export type { AuditLogEntry, AuditLogFilters } from "./types";
```

### Bước 8: Tạo route page

```tsx
// pages/AuditLogsPage.tsx
import { MainLayout } from "@/shared/components/layouts";
import { AuditLogPage } from "@/features/audit-logs";

export default function AuditLogsPage() {
  return (
    <MainLayout>
      <AuditLogPage />
    </MainLayout>
  );
}
```

---

## Checklist Feature Mới

- [ ] Tạo thư mục `features/[name]/`
- [ ] Định nghĩa `types.ts`
- [ ] Tạo `api.ts`
- [ ] Tạo hooks trong `hooks/`
- [ ] Tạo components trong `components/`
- [ ] Tạo main component
- [ ] Export qua `index.ts`
- [ ] Tạo route page trong `pages/`
- [ ] Thêm route vào `App.tsx`
