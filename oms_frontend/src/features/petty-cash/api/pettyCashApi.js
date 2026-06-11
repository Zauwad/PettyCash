import axiosInstance from '@/shared/lib/axios';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';

export const pettyCashApi = {
  /**
   * List petty cash requests.
   * Supports filtering by state, priority, and department.
   */
  async list(params = {}) {
    const response = await axiosInstance.get(API_ENDPOINTS.PETTY_CASH, { params });
    return response.data;
  },

  /**
   * Retrieve a single petty cash request by UUID.
   */
  async get(uuid) {
    const response = await axiosInstance.get(`${API_ENDPOINTS.PETTY_CASH}${uuid}/`);
    return response.data;
  },

  /**
   * Create a new petty cash request.
   */
  async create(data) {
    const response = await axiosInstance.post(API_ENDPOINTS.PETTY_CASH, data);
    return response.data;
  },

  /**
   * Update a draft petty cash request.
   */
  async update(uuid, data) {
    const response = await axiosInstance.patch(`${API_ENDPOINTS.PETTY_CASH}${uuid}/`, data);
    return response.data;
  },

  /**
   * Submit a draft request.
   */
  async submit(uuid) {
    const response = await axiosInstance.post(`${API_ENDPOINTS.PETTY_CASH}${uuid}/submit/`);
    return response.data;
  },

  /**
   * Approve a pending request (Team Lead / CEO).
   * Optionally specify an approved_amount.
   */
  async approve(uuid, approvedAmount = null) {
    const data = approvedAmount ? { approved_amount: approvedAmount } : {};
    const response = await axiosInstance.post(`${API_ENDPOINTS.PETTY_CASH}${uuid}/approve/`, data);
    return response.data;
  },

  /**
   * Reject a pending request (Team Lead / CEO).
   * A reason must be provided.
   */
  async reject(uuid, reason) {
    const response = await axiosInstance.post(`${API_ENDPOINTS.PETTY_CASH}${uuid}/reject/`, { reason });
    return response.data;
  },

  /**
   * Amend a rejected request to move it back to draft.
   */
  async amend(uuid) {
    const response = await axiosInstance.post(`${API_ENDPOINTS.PETTY_CASH}${uuid}/amend/`);
    return response.data;
  },

  /**
   * Cancel a request.
   */
  async cancel(uuid) {
    const response = await axiosInstance.post(`${API_ENDPOINTS.PETTY_CASH}${uuid}/cancel/`);
    return response.data;
  },

  /**
   * Disburse approved funds (Accounts/Admins/CEOs).
   * Request body contains amount, payment_method, reference_number, notes.
   */
  async disburse(uuid, disburseData) {
    const response = await axiosInstance.post(`${API_ENDPOINTS.PETTY_CASH}${uuid}/disburse/`, disburseData);
    return response.data;
  },

  /**
   * Upload attachments for a draft request.
   * Takes a list of Files and sends them via FormData.
   */
  async uploadAttachments(uuid, files) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    const response = await axiosInstance.post(`${API_ENDPOINTS.PETTY_CASH}${uuid}/attachments/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Express bulk approvals/rejections for managers.
   * Action must be 'approve' or 'reject'.
   */
  async bulkAction(requestIds, action, reason = '') {
    const response = await axiosInstance.post(API_ENDPOINTS.PETTY_CASH_BULK, {
      request_ids: requestIds,
      action,
      reason,
    });
    return response.data;
  },
};
