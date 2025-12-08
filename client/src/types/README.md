# Types

Thư mục chứa TypeScript type definitions và interfaces.

## Files

### `user.types.ts`
User-related types
```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}
```

### `api.types.ts`
API request/response types
```typescript
export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}
```

### `common.types.ts`
Common utility types

## Best Practices

1. Export types/interfaces từ `index.ts`
2. Sử dụng `interface` cho object types
3. Sử dụng `type` cho unions/intersections
4. Tên type phải rõ ràng và mô tả đúng
