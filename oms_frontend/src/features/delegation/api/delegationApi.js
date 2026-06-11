import axiosInstance from '@/shared/lib/axios';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';

export const delegationApi = {
  /**
   * List delegations where the user is delegator or delegate.
   */
  async list(params = {}) {
    const response = await axiosInstance.get(API_ENDPOINTS.DELEGATIONS, { params });
    return response.data;
  },

  /**
   * Create an Out-of-Office (OOO) delegation record.
   */
  async create(data) {
    const response = await axiosInstance.post(API_ENDPOINTS.DELEGATIONS, data);
    return response.data;
  },

  /**
   * Revoke an active delegation.
   */
  async revoke(id) {
    const response = await axiosInstance.delete(`${API_ENDPOINTS.DELEGATIONS}${id}/`);
    return response.data;
  },
};
