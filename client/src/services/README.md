# Services

Thư mục chứa các API services và business logic.

## Cấu trúc

```
services/
  api/
    client.ts         # Axios instance configuration
    endpoints.ts      # API endpoints constants
  auth.service.ts     # Authentication services
  user.service.ts     # User CRUD services
  storage.service.ts  # LocalStorage/SessionStorage wrapper
```

## API Client Setup

```typescript
// api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptors for token, error handling
```

## Service Pattern

```typescript
// auth.service.ts
export const authService = {
  login: async (credentials) => { ... },
  register: async (data) => { ... },
  logout: () => { ... },
};
```
