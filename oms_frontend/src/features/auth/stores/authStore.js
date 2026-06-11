import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setAuth: (user, accessToken) => set(() => {
    if (!user) {
      return {
        user: null,
        accessToken: null,
        isAuthenticated: false,
      };
    }

    // Normalize user to support both flat and nested profile structures
    const normalizedUser = { ...user };
    if (user.profile) {
      normalizedUser.role = user.role || user.profile.role;
      normalizedUser.employee_id = user.employee_id || user.profile.employee_id;
      normalizedUser.organization = user.organization || user.profile.organization;
      normalizedUser.department = user.department || user.profile.department;
    } else {
      normalizedUser.profile = {
        role: user.role,
        employee_id: user.employee_id,
        organization: user.organization,
        department: user.department,
      };
    }

    return {
      user: normalizedUser,
      accessToken,
      isAuthenticated: true,
    };
  }),

  clearAuth: () => set({
    user: null,
    accessToken: null,
    isAuthenticated: false,
  }),

  updateProfile: (updatedProfile) => set((state) => {
    if (!state.user) return state;
    return {
      user: {
        ...state.user,
        ...updatedProfile,
        profile: {
          ...state.user.profile,
          ...updatedProfile,
        }
      }
    };
  }),
}));

