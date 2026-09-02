export const EVENTS_PUBLIC_URL = (
  process.env.EXPO_PUBLIC_EVENTS_INFO_SECTION_URL ||
  process.env.EVENTS_INFO_SECTION_URL ||
  ''
).replace(/\/+$/, '');

export const EVENTS_APP_URL = (process.env.EXPO_PUBLIC_APP_URL || '').replace(/\/+$/, '');

export const EVENTS_USE_PROXY =
  String(process.env.EXPO_PUBLIC_EVENTS_INFO_USE_PROXY || '').toLowerCase() === 'true';

export const EVENTS_API_KEY = (
  process.env.EXPO_PUBLIC_EVENTS_INFO_SECTION_KEY ||
  process.env.EVENTS_INFO_SECTION_KEY ||
  ''
).trim();

export const EVENTS_REQUEST_BASE = EVENTS_USE_PROXY ? EVENTS_APP_URL : EVENTS_PUBLIC_URL;

export const EVENTS_API_PREFIX = EVENTS_USE_PROXY ? 'api/events-info' : 'api';

export function eventsInfoImageSource(uri, token) {
  if (!uri) return null;
  const needsAuth = String(uri).includes('/api/events-info/');
  if (!needsAuth || !token) {
    return { uri };
  }
  return {
    uri,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'image/*',
    },
  };
}
