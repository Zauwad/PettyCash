import axiosInstance from '@/shared/lib/axios';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';

export const authApi = {
  /**
   * Logs a user in with username and password.
   * On success, returns tokens and user profile payload.
   */
  async login(username, password) {
    const response = await axiosInstance.post(API_ENDPOINTS.LOGIN, {
      username,
      password,
    });
    return response.data;
  },

  /**
   * Fetches the current authenticated user's profile information.
   */
  async getMe() {
    const response = await axiosInstance.get(API_ENDPOINTS.ME);
    return response.data;
  },

  /**
   * Partially updates the current user's profile details (phone, avatar_url).
   */
  async updateProfile(data) {
    const response = await axiosInstance.patch(API_ENDPOINTS.ME, data);
    return response.data;
  },
};
