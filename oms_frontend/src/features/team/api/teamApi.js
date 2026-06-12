import axiosInstance from '@/shared/lib/axios';

export const teamApi = {
  /**
   * Fetches all users scoped to the organization.
   * Scopes include profile and department specs.
   */
  async getUsers() {
    const response = await axiosInstance.get('/api/users/');
    return response.data;
  },

  /**
   * Updates an employee's role.
   * @param {number} userId - User ID to update
   * @param {string} role - Role code string
   */
  async changeRole(userId, role) {
    const response = await axiosInstance.post(`/api/users/${userId}/change-role/`, { role });
    return response.data;
  },

  /**
   * Creates a new organization user account.
   * @param {object} data - Form data containing user credentials and profile options
   */
  async createMember(data) {
    const response = await axiosInstance.post('/api/users/', data);
    return response.data;
  },

  /**
   * Fetches all departments belonging to the current organization.
   */
  async getDepartments() {
    const response = await axiosInstance.get('/api/departments/');
    return response.data;
  }
};
