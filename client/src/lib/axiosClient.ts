
import axios from "axios";
import { API_CONFIG } from "@/constants";

const axiosClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  withCredentials: true, // Send httpOnly cookies with requests
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor (no longer needed for token since we use httpOnly cookies)
axiosClient.interceptors.request.use(
  (config) => {
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
