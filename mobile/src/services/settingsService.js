import api from './api';
import { withErrorHandling } from '../utils/apiHandler';

export const settingsService = {
  getPublicSettings: () =>
    withErrorHandling(() => api.get('/settings/public')),
};

export default settingsService;
