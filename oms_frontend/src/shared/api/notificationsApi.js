import axiosInstance from '@/shared/lib/axios';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';

export const notificationsApi = {
  /**
   * Fetch in-app notifications for the logged-in user.
   */
  async list(params = {}) {
    const response = await axiosInstance.get(API_ENDPOINTS.NOTIFICATIONS, { params });
    return response.data;
  },

  /**
   * Mark notifications as read.
   * Optionally pass a list of IDs. If empty, marks all as read.
   */
  async markRead(notificationIds = []) {
    const response = await axiosInstance.post(API_ENDPOINTS.NOTIFICATIONS_MARK_READ, {
      notification_ids: notificationIds,
    });
    return response.data;
  },
};
