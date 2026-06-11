import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

export function useAuth() {
  const { user, accessToken, isAuthenticated, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('refreshToken');
    clearAuth();
    navigate('/login');
  };

  return {
    user,
    accessToken,
    isAuthenticated,
    logout,
  };
}
