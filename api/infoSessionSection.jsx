import axios from 'axios';
import { getAuthToken } from '@/utils/authTokenStorage';
import {
  EVENTS_APP_URL,
  EVENTS_PUBLIC_URL,
  EVENTS_USE_PROXY,
  EVENTS_REQUEST_BASE,
  EVENTS_API_PREFIX,
  assertEventsProxyConfig,
  eventsAuthHeaders,
} from '@/utils/eventsConfig';

const ensureConfig = async () => {
  assertEventsProxyConfig();
};

const authHeaders = () => eventsAuthHeaders(getAuthToken);

const buildUrl = (endpoint) => `${EVENTS_REQUEST_BASE}/${EVENTS_API_PREFIX}/${endpoint}`;

const get = async (endpoint) => {
  await ensureConfig();
  return axios.get(buildUrl(endpoint), { headers: await authHeaders() });
};

const put = async (endpoint, data) => {
  await ensureConfig();
  return axios.put(buildUrl(endpoint), data, { headers: await authHeaders() });
};

const postMultipart = async (endpoint, formData) => {
  await ensureConfig();
  const headers = await authHeaders();
  return axios.post(buildUrl(endpoint), formData, {
    headers: {
      Authorization: headers.Authorization,
      Accept: 'application/json',
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const InfoSessionAPI = {
  BASE_URL: EVENTS_PUBLIC_URL,
  APP_URL: EVENTS_APP_URL,
  USE_PROXY: EVENTS_USE_PROXY,
  getInfoSessions: () => get('lionsgate/infosessions'),
  getSessionData: (sessionId) => get(`session-data?id=${sessionId}`),
  validateInvitation: (payload) => put('validate-invitation', payload),
  manualChecking: (participantId) => put('manual-checking', { id: Number(participantId) }),
  getProfileData: (participantId) => get(`profile-data?id=${participantId}`),
  uploadSessionPhoto: (participantId, photoFile) => {
    const form = new FormData();
    form.append('id', String(participantId));
    form.append('photo', photoFile);
    return postMultipart('session-photo', form);
  },
};

export default InfoSessionAPI;
