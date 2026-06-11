import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/constants/apiEndpoints';
import { useAuthStore } from '@/features/auth/stores/authStore';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Ensure cookies are sent if needed, although simplejwt uses headers by default
  withCredentials: true,
});

// Request Interceptor: Attach the JWT access token if available
axiosInstance.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle automatic token refreshing on 401 Unauthorized errors
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if error is 401 and we haven't retried this request yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (refreshToken) {
        try {
          // Attempt to fetch a new access token using the refresh token
          const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.REFRESH}`, {
            refresh: refreshToken,
          });
          
          const newAccessToken = response.data.access;
          const user = useAuthStore.getState().user;
          
          // If the backend also rotates the refresh token (configured in django SIMPLE_JWT)
          if (response.data.refresh) {
            localStorage.setItem('refreshToken', response.data.refresh);
          }
          
          // Update the authStore with the new access token
          useAuthStore.getState().setAuth(user, newAccessToken);
          
          // Update the headers of the original request and retry
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          // Refresh token is expired or invalid; log the user out
          localStorage.removeItem('refreshToken');
          useAuthStore.getState().clearAuth();
          
          // Redirect to login page if window is defined
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token; clear auth and redirect
        useAuthStore.getState().clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
