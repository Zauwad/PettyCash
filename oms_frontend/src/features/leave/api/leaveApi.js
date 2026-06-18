import axiosInstance from '@/shared/lib/axios';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';

export const leaveApi = {
  /**
   * List leave requests for the logged-in user or department.
   */
  async listRequests(params = {}) {
    const response = await axiosInstance.get(API_ENDPOINTS.LEAVE_REQUESTS, { params });
    return response.data;
  },

  /**
   * Retrieve details of a single leave request by UUID.
   */
  async getRequest(uuid) {
    const response = await axiosInstance.get(`${API_ENDPOINTS.LEAVE_REQUESTS}${uuid}/`);
    return response.data;
  },

  /**
   * Create a new leave request.
   */
  async createRequest(data) {
    const response = await axiosInstance.post(API_ENDPOINTS.LEAVE_REQUESTS, data);
    return response.data;
  },

  /**
   * Submit a draft leave request.
   */
  async submitRequest(uuid) {
    const response = await axiosInstance.post(`${API_ENDPOINTS.LEAVE_REQUESTS}${uuid}/submit/`);
    return response.data;
  },

  /**
   * Approve a pending leave request.
   */
  async approveRequest(uuid, data = {}) {
    const response = await axiosInstance.post(`${API_ENDPOINTS.LEAVE_REQUESTS}${uuid}/approve/`, data);
    return response.data;
  },

  /**
   * Reject a pending leave request.
   * Requires a reason.
   */
  async rejectRequest(uuid, reason) {
    const response = await axiosInstance.post(`${API_ENDPOINTS.LEAVE_REQUESTS}${uuid}/reject/`, { reason });
    return response.data;
  },

  /**
   * Amend a rejected leave request back to draft.
   */
  async amendRequest(uuid) {
    const response = await axiosInstance.post(`${API_ENDPOINTS.LEAVE_REQUESTS}${uuid}/amend/`);
    return response.data;
  },

  /**
   * Cancel a leave request.
   */
  async cancelRequest(uuid) {
    const response = await axiosInstance.post(`${API_ENDPOINTS.LEAVE_REQUESTS}${uuid}/cancel/`);
    return response.data;
  },

  /**
   * List leave balances for a user and calendar year.
   */
  async listBalances(params = {}) {
    const response = await axiosInstance.get(API_ENDPOINTS.LEAVE_BALANCES, { params });
    return response.data;
  },

  /**
   * List configured leave types for the tenant organization.
   */
  async listTypes(params = {}) {
    const response = await axiosInstance.get(API_ENDPOINTS.LEAVE_TYPES, { params });
    return response.data;
  },

  /**
   * List company holidays.
   */
  async listHolidays(params = {}) {
    const response = await axiosInstance.get(API_ENDPOINTS.LEAVE_HOLIDAYS, { params });
    return response.data;
  },

  /**
   * Live calculation of working days (excludes weekends and holidays) between dates.
   */
  async calculateDays(startDate, endDate) {
    const response = await axiosInstance.post(API_ENDPOINTS.LEAVE_CALCULATE, {
      start_date: startDate,
      end_date: endDate,
    });
    return response.data;
  },

  /**
   * Fetch a monthly view calendar of approved absences.
   */
  async getTeamCalendar(month = null, year = null) {
    const params = {};
    if (month) params.month = month;
    if (year) params.year = year;
    const response = await axiosInstance.get(API_ENDPOINTS.LEAVE_TEAM_CALENDAR, { params });
    return response.data;
  },

  /**
   * Fetch a list of overlapping leaves for a date range.
   */
  async getOverlappingLeaves(startDate, endDate, excludeUuid = null) {
    const params = { start_date: startDate, end_date: endDate };
    if (excludeUuid) params.exclude_uuid = excludeUuid;
    const response = await axiosInstance.get(`${API_ENDPOINTS.LEAVE_REQUESTS}overlapping-leaves/`, { params });
    return response.data;
  },

  /**
   * Upload attachments for a draft leave request.
   */
  async uploadAttachments(uuid, files) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    const response = await axiosInstance.post(`${API_ENDPOINTS.LEAVE_REQUESTS}${uuid}/attachments/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
