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
<<<<<<< HEAD
  DASHBOARD: "/dashboard",
  PROFILE: "/profile",
  AUDIT_LOGS: "/audit-logs",
  WIZARD: "/wizard",
  MY_REQUESTS: "/requests",
=======
  FORGOT_PASSWORD: "/forgot-password",
  DASHBOARD: "/admin/dashboard",
  PROFILE: "/admin/profile",
  AUDIT_LOGS: "/admin/audit-logs",
  REVIEW_MODERATION: "/admin/reviews",
  TRUST_PROFILES: "/admin/trust-profiles",
  FREELANCERS: "/admin/freelancers",
  PROJECTS: "/admin/projects",
  ANALYTICS: "/admin/analytics",
  SETTINGS: "/admin/settings",
>>>>>>> 39ad7d20f115c4bc167dcf614e6cec260a7595d2
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
