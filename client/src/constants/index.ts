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
  FORGOT_PASSWORD: "/forgot-password",

  // ========== CLIENT ROUTES - prefix /client ==========
  CLIENT_DASHBOARD: "/client/dashboard",
  CLIENT_MY_REQUESTS: "/client/my-requests",
  CLIENT_WIZARD: "/client/wizard",
  CLIENT_PROFILE: "/client/profile",
  
  // ========== BROKER ROUTES - prefix /broker ==========
  BROKER_DASHBOARD: "/broker/dashboard",

  // ========== PROJECT ROUTES ==========
  CLIENT_PROJECTS: "/client/projects",
  CLIENT_WORKSPACE: "/client/workspace/:projectId",

  // ========== ADMIN ROUTES - prefix /admin ==========
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_AUDIT_LOGS: "/admin/audit-logs",
  ADMIN_REVIEW_MODERATION: "/admin/reviews",
  ADMIN_PROFILE: "/admin/profile",

  // ========== LEGACY ALIASES (backward compatibility) ==========
  DASHBOARD: "/admin/dashboard",
  WIZARD: "/client/wizard",
  MY_REQUESTS: "/client/my-requests",
  PROFILE: "/admin/profile",
  AUDIT_LOGS: "/admin/audit-logs",
  REVIEW_MODERATION: "/admin/reviews",

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
