import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function ProtectedRoute({ children, allowedRoles, allowHR }) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    // Save the intended route location to redirect back after successful authentication
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isHR = user?.profile?.department?.name?.toUpperCase().includes('HR');

  // Enforce role-based dashboard restrictions
  if (allowedRoles) {
    const roleAllowed = user?.profile?.role && allowedRoles.includes(user.profile.role);
    const hrAllowed = allowHR && isHR;
    
    if (!roleAllowed && !hrAllowed) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
