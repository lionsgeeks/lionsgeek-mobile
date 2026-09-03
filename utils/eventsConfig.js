/**
 * Events / info-session section API config.
 * Mobile is proxy-only: Sanctum PAT via /api/events-info/* — never ship a section API key.
 */

export const EVENTS_PUBLIC_URL = (
  process.env.EXPO_PUBLIC_EVENTS_INFO_SECTION_URL ||
  process.env.EVENTS_INFO_SECTION_URL ||
  ''
).replace(/\/+$/, '');

export const EVENTS_APP_URL = (process.env.EXPO_PUBLIC_APP_URL || '').replace(/\/+$/, '');

export const EVENTS_USE_PROXY =
  String(process.env.EXPO_PUBLIC_EVENTS_INFO_USE_PROXY || '').toLowerCase() === 'true';

/** @deprecated Always empty — section keys must not ship in the client bundle. */
export const EVENTS_API_KEY = '';

export const EVENTS_REQUEST_BASE = EVENTS_APP_URL;
export const EVENTS_API_PREFIX = 'api/events-info';

export function assertEventsProxyConfig() {
  if (!EVENTS_USE_PROXY) {
    throw new Error(
      'Events API must use proxy mode. Set EXPO_PUBLIC_EVENTS_INFO_USE_PROXY=true and restart Expo with: npx expo start -c'
    );
  }
  if (!EVENTS_APP_URL) {
    throw new Error(
      'EXPO_PUBLIC_APP_URL is not set but proxy mode is on. Set it in .env and restart Expo with: npx expo start -c'
    );
  }
}

/**
 * Auth headers for events/info-session requests (Sanctum Bearer only).
 * @param {() => Promise<string|null>} getAuthToken
 */
export async function eventsAuthHeaders(getAuthToken) {
  assertEventsProxyConfig();
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Authentication token is required');
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

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
