/**
 * Dynamic Expo config.
 * google-services.json stays gitignored locally.
 * On EAS Build, set a file env var named GOOGLE_SERVICES_JSON (type: file).
 */
const appJson = require('./app.json');

module.exports = () => {
  const config = appJson.expo;

  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    },
  };
};
