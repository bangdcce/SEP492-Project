import { io, type Socket } from "socket.io-client";
import { API_CONFIG } from "@/constants";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(`${API_CONFIG.BASE_URL}/ws`, {
      autoConnect: false,
      transports: ["websocket"],
      withCredentials: true, // Enable sending cookies with socket connection
    });
  }
  return socket;
};

export const connectSocket = () => {
  const instance = getSocket();
  // Token is now sent automatically via httpOnly cookie
  // No need to manually set auth token

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
