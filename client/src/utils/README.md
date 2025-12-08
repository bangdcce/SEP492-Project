# Utils

Thư mục chứa utility functions và helper methods.

## Files

### `formatters.ts`
Format functions (date, currency, etc.)
```typescript
export const formatDate = (date: Date) => { ... };
export const formatCurrency = (amount: number) => { ... };
```

### `validators.ts`
Validation functions
```typescript
export const isValidEmail = (email: string) => { ... };
export const isStrongPassword = (password: string) => { ... };
```

### `helpers.ts`
General helper functions
```typescript
export const debounce = (fn, delay) => { ... };
export const throttle = (fn, limit) => { ... };
```

### `constants.ts`
Constant values
```typescript
export const API_ENDPOINTS = { ... };
export const ROUTES = { ... };
```

## Best Practices

1. Pure functions khi có thể
2. Document functions phức tạp
3. Export named exports
4. Write unit tests
