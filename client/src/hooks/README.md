# Hooks

Thư mục chứa custom React hooks.

## Custom Hooks

### `useAuth.ts`
Hook quản lý authentication state và methods

### `useFetch.ts`
Hook để fetch data với loading/error states

### `useForm.ts`
Hook quản lý form state và validation

### `useDebounce.ts`
Hook debounce values

### `useLocalStorage.ts`
Hook sync state với localStorage

## Example

```typescript
// useAuth.ts
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const login = async (credentials) => { ... };
  const logout = () => { ... };
  
  return { user, loading, login, logout };
};
```

## Usage

```typescript
const { user, login, logout } = useAuth();
```
