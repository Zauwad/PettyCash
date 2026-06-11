import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import { useAuthStore } from '../stores/authStore';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: ({ username, password }) => authApi.login(username, password),
    onSuccess: (data) => {
      // Persist the refresh token in localStorage for persistence across reloads
      if (data.refresh) {
        localStorage.setItem('refreshToken', data.refresh);
      }
      
      // Update our global Zustand auth store
      setAuth(data.user, data.access);
    },
  });
}
