import axiosInstance from '@/shared/lib/axios';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';

export const analyticsApi = {
  /**
   * Fetch spending trends (CEOs / Admins only).
   */
  async getSpendingTrends() {
    const response = await axiosInstance.get(API_ENDPOINTS.ANALYTICS_TRENDS);
    return response.data;
  },

  /**
   * Fetch budget burn rates (CEOs / Admins only).
   */
  async getBudgetBurnRate() {
    const response = await axiosInstance.get(API_ENDPOINTS.ANALYTICS_BURN_RATE);
    return response.data;
  },

  /**
   * Fetch upcoming absences in next 30 days.
   */
  async getUpcomingAbsences() {
    const response = await axiosInstance.get(API_ENDPOINTS.ANALYTICS_ABSENCES);
    return response.data;
  },

  /**
   * Fetch summary dashboard numbers.
   */
  async getSummary() {
    const response = await axiosInstance.get(API_ENDPOINTS.ANALYTICS_SUMMARY);
    return response.data;
  },

  /**
   * Fetch weekly report data (CEO / Admin / GM / TL / HR only).
   */
  async getWeeklyReport() {
    const response = await axiosInstance.get(API_ENDPOINTS.ANALYTICS_WEEKLY_REPORT);
    return response.data;
  },

  /**
   * Fetch monthly report data (CEO / Admin / GM / TL / HR only).
   */
  async getMonthlyReport() {
    const response = await axiosInstance.get(API_ENDPOINTS.ANALYTICS_MONTHLY_REPORT);
    return response.data;
  },

  /**
   * Fetch quarterly report data (CEO / Admin / GM / TL / HR only).
   */
  async getQuarterlyReport() {
    const response = await axiosInstance.get(API_ENDPOINTS.ANALYTICS_QUARTERLY_REPORT);
    return response.data;
  },
};
