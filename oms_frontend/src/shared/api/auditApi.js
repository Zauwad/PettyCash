import axiosInstance from '@/shared/lib/axios';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';

export const auditApi = {
  /**
   * Fetch recent audit log activities.
   */
  async list(params = {}) {
    const response = await axiosInstance.get(API_ENDPOINTS.AUDIT_LOGS, { params });
    return response.data;
  },
};
