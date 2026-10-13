import api from './api';
import { withErrorHandling } from '../utils/apiHandler';

export const settingsService = {
  getPublicSettings: () =>
    withErrorHandling(() => api.get('/settings/public')),
  // Real platform counts (categories, customers, average job rating) for the welcome screen
  getPublicStats: () =>
    withErrorHandling(() => api.get('/settings/public/stats')),
};

export default settingsService;
