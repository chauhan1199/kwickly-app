import api from './api';

const settingsService = {
  getPublicSettings: () => api.get('/settings/public'),
};

export default settingsService;
