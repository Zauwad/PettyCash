import { useState, useEffect } from 'react';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { authApi } from '@/features/auth/api/authApi';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/constants/apiEndpoints';
import axios from 'axios';

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    async function bootstrapAuth() {
      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        setLoading(false);
        return;
      }

      try {
        // 1. Send call to refresh token
        const refreshResponse = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.REFRESH}`, {
          refresh: refreshToken,
        });

        const newAccessToken = refreshResponse.data.access;
        if (refreshResponse.data.refresh) {
          localStorage.setItem('refreshToken', refreshResponse.data.refresh);
        }

        // Set temporary user so that request interceptor picks up the Authorization header
        setAuth({ id: 'bootstrap_temp' }, newAccessToken);

        // 2. Retrieve detailed user profile info
        const userProfile = await authApi.getMe();

        // 3. Fully login the user
        setAuth(userProfile, newAccessToken);
      } catch (error) {
        console.error('Failed to bootstrap auth session:', error);
        localStorage.removeItem('refreshToken');
        clearAuth();
      } finally {
        setLoading(false);
      }
    }

    bootstrapAuth();
  }, [setAuth, clearAuth]);

  if (loading) {
    // Premium loading panel with dynamic pulse state
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-base-100">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="loading loading-ring loading-xl text-primary scale-125"></span>
          <div>
            <h3 className="text-lg font-semibold tracking-wide text-base-content">Operations Portal</h3>
            <p className="text-xs font-medium text-base-content/40 mt-1 animate-pulse">Establishing secure session...</p>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
