import { io, type Socket } from "socket.io-client";
import { API_CONFIG, STORAGE_KEYS } from "@/constants";
import { getStoredItem, getStoredJson } from "@/shared/utils/storage";

let socket: Socket | null = null;
const namespaceSockets = new Map<string, Socket>();
let activeSocketUserId: string | null = null;
let authSyncListenersBound = false;

const isUserLoggedIn = (): boolean => {
  const user = getStoredItem(STORAGE_KEYS.USER);
  return user !== null && user !== "null";
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

const createSocket = (namespace: string): Socket => {
  const instance = io(`${API_CONFIG.BASE_URL}${namespace}`, {
    autoConnect: false,
    transports: ["websocket"],
    withCredentials: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  instance.on("connect_error", (error: Error) => {
    const shouldForceDisconnect =
      !isUserLoggedIn() || isAuthSocketError(error?.message);

    if (shouldForceDisconnect) {
      clearSocketReference(namespace, instance);
      instance.removeAllListeners();
      instance.disconnect();
    }
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
