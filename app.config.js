/**
 * Dynamic Expo config.
 * google-services.json stays gitignored locally.
 * On EAS Build, set a file env var named GOOGLE_SERVICES_JSON (type: file).
 */
export default ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
