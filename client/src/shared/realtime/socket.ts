import { io, type Socket } from "socket.io-client";
import { API_CONFIG, STORAGE_KEYS } from "@/constants";
import { getStoredItem } from "@/shared/utils/storage";

let socket: Socket | null = null;

const isUserLoggedIn = (): boolean => {
  const user = getStoredItem(STORAGE_KEYS.USER);
  return user !== null && user !== "null";
};

export const getSocket = () => {
  if (!socket) {
    socket = io(`${API_CONFIG.BASE_URL}/ws`, {
      autoConnect: false,
      transports: ["websocket"],
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on("connect_error", (err) => {
      if (!isUserLoggedIn()) {
        socket?.disconnect();
      }
    });
  }
  return socket;
};

export const connectSocket = () => {
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
  if (socket) {
    socket.disconnect();
  }
};
