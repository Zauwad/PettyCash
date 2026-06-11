// API endpoints for Operation Management System
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000';

export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/api/token/',
  REFRESH: '/api/token/refresh/',
  ME: '/api/me/',
  
  // Petty Cash Module
  PETTY_CASH: '/api/petty-cash/',
  PETTY_CASH_BULK: '/api/petty-cash/bulk-action/',
  PETTY_CASH_ATTACHMENT: '/api/attachments/',
  
  // Leave Module
  LEAVE_REQUESTS: '/api/leave/requests/',
  LEAVE_BALANCES: '/api/leave/balances/',
  LEAVE_TYPES: '/api/leave/types/',
  LEAVE_HOLIDAYS: '/api/leave/holidays/',
  LEAVE_CALCULATE: '/api/leave/requests/calculate-days/',
  LEAVE_TEAM_CALENDAR: '/api/leave/requests/team-calendar/',
  
  // Delegations
  DELEGATIONS: '/api/delegations/',
  
  // Notifications
  NOTIFICATIONS: '/api/notifications/',
  NOTIFICATIONS_MARK_READ: '/api/notifications/mark-read/',
  
  // Analytics
  ANALYTICS_TRENDS: '/api/analytics/spending-trends/',
  ANALYTICS_BURN_RATE: '/api/analytics/budget-burn-rate/',
  ANALYTICS_ABSENCES: '/api/analytics/upcoming-absences/',
  ANALYTICS_SUMMARY: '/api/analytics/summary/',
};
