import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { authApi } from "./api";
import type { LoginPayload, RegisterPayload, AuthState } from "./types";
import { STORAGE_KEYS } from "@/constants";

interface AuthContextType extends AuthState {
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  // Track if initial auth check has been done (prevents double-fetch in StrictMode)
  const hasCheckedAuth = useRef(false);

  // Check for existing token on mount
  useEffect(() => {
    // Skip if already checked (StrictMode protection)
    if (hasCheckedAuth.current) return;
    hasCheckedAuth.current = true;
    isMounted.current = true;

    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      authApi
        .getMe()
        .then((user) => {
          if (isMounted.current) {
            setState({ user, isAuthenticated: true, isLoading: false });
          }
        })
        .catch(() => {
          localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
          if (isMounted.current) {
            setState({ user: null, isAuthenticated: false, isLoading: false });
          }
        });
    } else {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }

    return () => {
      isMounted.current = false;
    };
  }, []);

  const login = async (payload: LoginPayload) => {
    const response = await authApi.login(payload);
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
    setState({ user: response.user, isAuthenticated: true, isLoading: false });
  };

  const register = async (payload: RegisterPayload) => {
    const response = await authApi.register(payload);
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
    setState({ user: response.user, isAuthenticated: true, isLoading: false });
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
