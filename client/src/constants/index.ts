/**
 * Application Constants
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  TIMEOUT: 30000,
} as const;

// Route Paths
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  // Client Routes
  CLIENT_DASHBOARD: "/client-dashboard",
  CLIENT_PROFILE: "/profile",
  CLIENT_AUDIT_LOGS: "/audit-logs",

  WIZARD: "/wizard",
  MY_REQUESTS: "/requests",
  REVIEW_MODERATION: "/admin/reviews",
  TRUST_PROFILES: "/admin/trust-profiles",
  FREELANCERS: "/admin/freelancers",
  PROJECTS: "/admin/projects",
  ANALYTICS: "/admin/analytics",
  SETTINGS: "/admin/settings",
  
  // Admin Routes
  FORGOT_PASSWORD: "/forgot-password",
  ADMIN_DASHBOARD: "/dashboard", // Admin gets the main /dashboard URL per user request
  ADMIN_PROFILE: "/admin/profile",
  ADMIN_AUDIT_LOGS: "/admin/audit-logs",
  
  // Admin Feature Routes (from Incoming)
  DASHBOARD: "/admin/dashboard", // Legacy/Incoming mapping, might be unused or redirect? Keeping for safety or aliasing.
  PROFILE: "/admin/profile",     // Legacy/Incoming mapping
  AUDIT_LOGS: "/admin/audit-logs", // Legacy/Incoming mapping
  NOT_FOUND: "/404",
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
  USER: "user",
  THEME: "theme",
} as const;

// Validation Rules
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;