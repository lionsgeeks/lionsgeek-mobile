import axios from 'axios';
import { getAuthToken } from '@/utils/authTokenStorage';
import {
  EVENTS_APP_URL,
  EVENTS_PUBLIC_URL,
  EVENTS_REQUEST_BASE,
  EVENTS_API_PREFIX,
  EVENTS_USE_PROXY,
  EVENTS_API_KEY,
} from '@/utils/eventsConfig';

const getSanctumToken = async () => {
  const tokenStr = await getAuthToken();
  if (!tokenStr) {
    throw new Error('Authentication token is required');
  }
  return tokenStr;
};

const ensureEventsConfig = async () => {
  if (EVENTS_USE_PROXY) {
    if (!EVENTS_APP_URL) {
      throw new Error(
        'EXPO_PUBLIC_APP_URL is not set but proxy mode is on. Set it in .env and restart Expo with: npx expo start -c'
      );
    }
    return;
  }
  if (!EVENTS_PUBLIC_URL) {
    throw new Error(
      'EXPO_PUBLIC_EVENTS_INFO_SECTION_URL is not set. Add it to .env and restart Expo with: npx expo start -c'
    );
  }
  if (!EVENTS_API_KEY) {
    throw new Error(
      'EXPO_PUBLIC_EVENTS_INFO_SECTION_KEY is not set. Add it to .env and restart Expo with: npx expo start -c'
    );
  }
};

const eventsAuthHeaders = async () => {
  if (EVENTS_USE_PROXY) {
    const token = await getSanctumToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  return {
    Authorization: `Bearer ${EVENTS_API_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
};

const buildEventsUrl = (endpoint) => `${EVENTS_REQUEST_BASE}/${EVENTS_API_PREFIX}/${endpoint}`;

const buildEventsBookingUrl = () => {
  if (EVENTS_USE_PROXY) {
    return `${EVENTS_APP_URL}/api/events-info/booking/store`;
  }
  if (!EVENTS_PUBLIC_URL) {
    throw new Error(
      'EXPO_PUBLIC_EVENTS_INFO_SECTION_URL is not set. Add it to .env and restart Expo with: npx expo start -c'
    );
  }
  return `${EVENTS_PUBLIC_URL}/api/booking/store`;
};

const getEventsInfo = async (endpoint) => {
  await ensureEventsConfig();
  return axios.get(buildEventsUrl(endpoint), { headers: await eventsAuthHeaders() });
};

const putEventsInfo = async (endpoint, data) => {
  await ensureEventsConfig();
  return axios.put(buildEventsUrl(endpoint), data, { headers: await eventsAuthHeaders() });
};

const postEventsBooking = async (data) => {
  await ensureEventsConfig();
  return axios.post(buildEventsBookingUrl(), data, { headers: await eventsAuthHeaders() });
};

export const getEvents = () => getEventsInfo('events');

export const getEvent = (eventId) => getEventsInfo(`events/${eventId}`);

export const storeEventBooking = (payload) => postEventsBooking(payload);

export const validateEventInvitation = (payload) =>
  putEventsInfo('validate-event-invitation', payload);

export const manualEventChecking = (bookingId, eventId) =>
  putEventsInfo('manual-event-checking', { id: Number(bookingId), event_id: Number(eventId) });
