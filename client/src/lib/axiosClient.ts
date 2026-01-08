
import axios from "axios";
import { API_CONFIG, STORAGE_KEYS } from "@/constants";

const axiosClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to add auth token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor for response handling
axiosClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized (e.g. redirect to login)
    if (error.response && error.response.status === 401) {
        // Optional: Dispatch logout event or clear storage
        // localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        // window.location.href = ROUTES.LOGIN;
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
