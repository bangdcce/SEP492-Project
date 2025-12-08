# Contexts

Thư mục chứa React Context providers cho global state management.

## Contexts

### `AuthContext.tsx`
Global authentication state
- Current user
- Login/logout methods
- Authentication status

### `ThemeContext.tsx`
Theme management (dark/light mode)

### `NotificationContext.tsx`
Global notification/toast system

## Structure

```typescript
// AuthContext.tsx
import { createContext, useContext, useState } from 'react';

interface AuthContextType {
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  
  const login = async (credentials) => { ... };
  const logout = () => { ... };
  
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```
