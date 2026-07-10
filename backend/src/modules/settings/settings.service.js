const AppSettings = require('./settings.model');
const { getCache, setCache } = require('../../helpers/redis.helper');
const logger = require('../../helpers/logger.helper');

class SettingsService {
    static async getAppSettings() {
        try {
            let settings = await getCache('app_settings');
            if (!settings) {
                settings = await AppSettings.findOne({ isSingleton: 'CONFIG' }).lean();
                if (settings) {
                    await setCache('app_settings', settings, 600); // 10 minutes cache
                }
            }
            return settings || {};
        } catch (error) {
            logger.error(`Error fetching AppSettings in SettingsService: ${error.message}`);
            return {};
        }
    }
}

module.exports = SettingsService;
