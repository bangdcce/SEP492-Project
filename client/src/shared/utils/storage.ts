/**
 * Auth storage helpers - support remember me via localStorage vs sessionStorage.
 */

export const getStoredItem = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  const sessionValue = window.sessionStorage.getItem(key);
  if (sessionValue !== null) return sessionValue;
  return window.localStorage.getItem(key);
};

export const setStoredItem = (
  key: string,
  value: string,
  remember: boolean
) => {
  if (typeof window === "undefined") return;
  if (remember) {
    window.localStorage.setItem(key, value);
    window.sessionStorage.removeItem(key);
    return;
  }
  window.sessionStorage.setItem(key, value);
  window.localStorage.removeItem(key);
};

export const setStoredItemAuto = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(key) !== null) {
    window.sessionStorage.setItem(key, value);
    return;
  }
  if (window.localStorage.getItem(key) !== null) {
    window.localStorage.setItem(key, value);
    return;
  }
  window.localStorage.setItem(key, value);
};

export const removeStoredItem = (key: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
};

export const getStoredJson = <T = unknown>(key: string): T | null => {
  const value = getStoredItem(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const setStoredJson = (
  key: string,
  value: unknown,
  remember: boolean
) => {
  setStoredItem(key, JSON.stringify(value), remember);
};

export const setStoredJsonAuto = (key: string, value: unknown) => {
  setStoredItemAuto(key, JSON.stringify(value));
};
