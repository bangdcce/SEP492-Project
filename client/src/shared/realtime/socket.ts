import { io, type Socket } from "socket.io-client";
import { API_CONFIG, STORAGE_KEYS } from "@/constants";
import { getStoredItem } from "@/shared/utils/storage";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(`${API_CONFIG.BASE_URL}/ws`, {
      autoConnect: false,
      transports: ["websocket"],
    });
  }
  return socket;
};

export const connectSocket = () => {
  const instance = getSocket();
  const token = getStoredItem(STORAGE_KEYS.ACCESS_TOKEN);
  instance.auth = { token };

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
