import { io, type Socket } from "socket.io-client";
import { API_CONFIG, STORAGE_KEYS } from "@/constants";
import { getStoredItem, getStoredJson } from "@/shared/utils/storage";

let socket: Socket | null = null;
const namespaceSockets = new Map<string, Socket>();
let activeSocketUserId: string | null = null;
let authSyncListenersBound = false;
let isRefreshingToken = false;

type SocketSubset = Pick<
  Socket,
  "on" | "once" | "off" | "emit" | "connect" | "disconnect" | "removeAllListeners" | "connected"
>;

type TestSocketFactory = (namespace: string) => SocketSubset | null | undefined;

declare global {
  interface Window {
    __INTERDEV_TEST_SOCKET_FACTORY__?: TestSocketFactory;
  }
}

const getRealtimeBaseUrl = (): string => {
  try {
    return new URL(API_CONFIG.BASE_URL).origin;
  } catch {
    return API_CONFIG.BASE_URL.replace(/\/+$/, "");
  }
};

const isUserLoggedIn = (): boolean => {
  const user = getStoredItem(STORAGE_KEYS.USER);
  return user !== null && user !== "null";
};

const refreshAccessTokenForSocket = async (): Promise<boolean> => {
  if (isRefreshingToken) return false;
  isRefreshingToken = true;

  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    isRefreshingToken = false;
  }
};

const isAuthSocketError = (message: string | undefined): boolean => {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("unauthorized") ||
    normalized.includes("missing token") ||
    normalized.includes("invalid token") ||
    normalized.includes("jwt")
  );
};

const getCurrentSocketUserId = (): string | null => {
  const user = getStoredJson<{ id?: string }>(STORAGE_KEYS.USER);
  if (!user?.id) {
    return null;
  }
  return user.id;
};

const destroySocketInstance = (instance: Socket | null): void => {
  if (!instance) {
    return;
  }
  instance.removeAllListeners();
  instance.disconnect();
};

const disconnectAllSocketsInternal = (): void => {
  destroySocketInstance(socket);
  socket = null;

  for (const instance of namespaceSockets.values()) {
    destroySocketInstance(instance);
  }
  namespaceSockets.clear();
};

const clearSocketReference = (namespace: string, instance: Socket): void => {
  if (socket === instance) {
    socket = null;
  }

  const namespaced = namespaceSockets.get(namespace);
  if (namespaced === instance) {
    namespaceSockets.delete(namespace);
  }
};

const syncSocketSession = (): void => {
  const currentUserId = getCurrentSocketUserId();
  if (activeSocketUserId === currentUserId) {
    return;
  }
  disconnectAllSocketsInternal();
  activeSocketUserId = currentUserId;
};

const ensureAuthSyncListeners = (): void => {
  if (authSyncListenersBound || typeof window === "undefined") {
    return;
  }

  authSyncListenersBound = true;

  const syncFromEvent = () => {
    syncSocketSession();
  };

  window.addEventListener("userDataUpdated", syncFromEvent);
  window.addEventListener("userLoggedIn", syncFromEvent);
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key === STORAGE_KEYS.USER) {
      syncFromEvent();
    }
  });
};

ensureAuthSyncListeners();

const handleSocketConnectError = async (
  namespace: string,
  instance: Socket,
  error: Error,
): Promise<void> => {
  if (!isUserLoggedIn()) {
    clearSocketReference(namespace, instance);
    instance.removeAllListeners();
    instance.disconnect();
    return;
  }

  if (!isAuthSocketError(error?.message)) {
    return;
  }

  const refreshed = await refreshAccessTokenForSocket();
  if (refreshed && !instance.connected) {
    setTimeout(() => {
      if (!instance.connected) {
        instance.connect();
      }
    }, 1200);
    return;
  }

  clearSocketReference(namespace, instance);
  instance.removeAllListeners();
  instance.disconnect();
};

const createSocket = (namespace: string): Socket => {
  const injectedFactory =
    typeof window !== "undefined" ? window.__INTERDEV_TEST_SOCKET_FACTORY__ : undefined;
  const injectedSocket = injectedFactory?.(namespace);
  if (injectedSocket) {
    return injectedSocket as Socket;
  }

  const instance = io(`${getRealtimeBaseUrl()}${namespace}`, {
    autoConnect: false,
    transports: ["polling", "websocket"],
    withCredentials: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 15000,
    upgrade: true,
  });

  instance.on("connect_error", (error: Error) => {
    void handleSocketConnectError(namespace, instance, error);
  });

  return instance;
};

export const getSocket = () => {
  syncSocketSession();
  if (!socket) {
    socket = createSocket("/ws");
  }
  return socket;
};

export const connectSocket = () => {
  syncSocketSession();
  const instance = getSocket();

  if (!isUserLoggedIn()) {
    return instance;
  }

  if (!instance.connected) {
    instance.connect();
  }

  return instance;
};

export const disconnectSocket = () => {
  destroySocketInstance(socket);
  socket = null;
};

const normalizeNamespace = (namespace: string): string => {
  if (!namespace) return "/ws";
  return namespace.startsWith("/") ? namespace : `/${namespace}`;
};

export const getNamespacedSocket = (namespace: string): Socket => {
  syncSocketSession();
  const normalizedNamespace = normalizeNamespace(namespace);
  const existingSocket = namespaceSockets.get(normalizedNamespace);
  if (existingSocket) {
    return existingSocket;
  }

  const createdSocket = createSocket(normalizedNamespace);
  namespaceSockets.set(normalizedNamespace, createdSocket);
  return createdSocket;
};

export const connectNamespacedSocket = (namespace: string): Socket => {
  syncSocketSession();
  const instance = getNamespacedSocket(namespace);

  if (!isUserLoggedIn()) {
    return instance;
  }

  if (!instance.connected) {
    instance.connect();
  }

  return instance;
};

export const disconnectNamespacedSocket = (namespace: string): void => {
  const normalizedNamespace = normalizeNamespace(namespace);
  const instance = namespaceSockets.get(normalizedNamespace);

  if (!instance) {
    return;
  }

  destroySocketInstance(instance);
  namespaceSockets.delete(normalizedNamespace);
};

export const disconnectAllSockets = (): void => {
  disconnectAllSocketsInternal();
};
