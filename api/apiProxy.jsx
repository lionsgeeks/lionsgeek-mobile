import axios from 'axios';
import { getAuthToken } from '@/utils/authTokenStorage';
import {
  EVENTS_APP_URL,
  EVENTS_REQUEST_BASE,
  EVENTS_API_PREFIX,
  assertEventsProxyConfig,
  eventsAuthHeaders as buildEventsAuthHeaders,
} from '@/utils/eventsConfig';

const ensureEventsConfig = async () => {
  assertEventsProxyConfig();
};

const eventsAuthHeaders = () => buildEventsAuthHeaders(getAuthToken);

const buildEventsUrl = (endpoint) => `${EVENTS_REQUEST_BASE}/${EVENTS_API_PREFIX}/${endpoint}`;

const buildEventsBookingUrl = () => `${EVENTS_APP_URL}/api/events-info/booking/store`;

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
