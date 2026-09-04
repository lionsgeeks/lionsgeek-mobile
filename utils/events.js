import { format, isValid, parseISO, startOfDay } from 'date-fns';
import { userHasAdminRole, userCanAccessScan } from '@/components/helpers/helpers';
import { EVENTS_APP_URL, EVENTS_PUBLIC_URL, EVENTS_USE_PROXY } from '@/utils/eventsConfig';

const OTHER_EVENTS_BATCH_SIZE = 4;

// Resolves multilingual event name JSON to a display string.
export function getEventDisplayName(name) {
  if (!name) return 'Untitled event';
  if (typeof name === 'string') {
    try {
      const parsed = JSON.parse(name);
      return getEventDisplayName(parsed);
    } catch {
      return name;
    }
  }
  if (typeof name === 'object') {
    return name.en || name.fr || name.ar || Object.values(name).find(Boolean) || 'Untitled event';
  }
  return String(name);
}

// Event cover filename/path to a loadable absolute image URL.
export function getEventCoverUrl(cover) {
  if (!cover || typeof cover !== 'string') return null;
  if (cover.startsWith('http://') || cover.startsWith('https://')) return cover;

  let filename = cover.trim();
  if (filename.includes('/')) {
    filename = filename.replace(/^\/+/, '').split('/').pop() || filename;
  }

  const encoded = encodeURIComponent(filename);

  if (EVENTS_USE_PROXY && EVENTS_APP_URL) {
    return `${EVENTS_APP_URL}/api/events-info/images/events/${encoded}`;
  }

  if (!EVENTS_PUBLIC_URL) return null;
  return `${EVENTS_PUBLIC_URL}/storage/images/events/${encoded}`;
}

export function getEventDate(event) {
  if (!event?.date) return null;
  const parsed = typeof event.date === 'string' ? parseISO(event.date) : new Date(event.date);
  return isValid(parsed) ? parsed : null;
}

export function isEventActiveForList(event) {
  const eventDate = getEventDate(event);
  if (!eventDate) return false;
  const today = startOfDay(new Date());
  const eventDay = startOfDay(eventDate);
  return eventDay >= today;
}

export function canScanEvent(event) {
  const eventDate = getEventDate(event);
  if (!eventDate) return false;
  if (hasEventPassed(event)) return false;

  const today = startOfDay(new Date());
  const eventDay = startOfDay(eventDate);
  return eventDay.getTime() === today.getTime();
}

export function userCanScanEvent(event, user) {
  if (userHasAdminRole(user)) return Boolean(event);
  return canScanEvent(event);
}

export function userCanCheckInEvent(event, user) {
  return userCanScanEvent(event, user);
}

export function formatEventDate(event) {
  const eventDate = getEventDate(event);
  if (!eventDate) return '—';
  return format(eventDate, 'EEE, MMM d, yyyy · HH:mm');
}

export function filterActiveEvents(events) {
  if (!Array.isArray(events)) return [];
  return events
    .filter(isEventActiveForList)
    .sort((a, b) => {
      const da = getEventDate(a)?.getTime() ?? 0;
      const db = getEventDate(b)?.getTime() ?? 0;
      return da - db;
    });
}

export function normalizeEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.filter((event) => getEventDate(event));
}

export function isPrivateEvent(event) {
  return Boolean(event?.is_private);
}

export function filterPublicEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.filter((event) => !isPrivateEvent(event));
}

export function filterEventsForViewer(events, user) {
  const list = normalizeEvents(events);
  if (userCanAccessScan(user)) return list;
  return filterPublicEvents(list);
}

export function sortEventsByDate(events, order = 'desc') {
  return [...events].sort((a, b) => {
    const da = getEventDate(a)?.getTime() ?? 0;
    const db = getEventDate(b)?.getTime() ?? 0;
    return order === 'desc' ? db - da : da - db;
  });
}

export function filterEventsByName(events, query) {
  const q = query.trim().toLowerCase();
  if (!q) return events;
  return events.filter((event) => getEventDisplayName(event?.name).toLowerCase().includes(q));
}

export function getEventStatusLabel(event, options = {}) {
  const { treatPastByDateTime = false } = options;
  if (treatPastByDateTime && hasEventPassed(event)) return 'Past';

  const eventDate = getEventDate(event);
  if (!eventDate) return 'Unknown';
  const today = startOfDay(new Date());
  const eventDay = startOfDay(eventDate);
  if (eventDay.getTime() === today.getTime()) return 'Today';
  if (eventDay > today) return 'Upcoming';
  return 'Past';
}

export function hasEventPassed(event) {
  const eventDate = getEventDate(event);
  if (!eventDate) return true;
  return Date.now() > eventDate.getTime();
}

export function canBookEvent(event) {
  if (!event || hasEventPassed(event)) return false;
  const remaining = Number(event?.capacity);
  return Number.isFinite(remaining) && remaining > 0;
}

export function userCanBookEvent(event, user) {
  if (!event) return false;
  if (userHasAdminRole(user)) return true;
  return canBookEvent(event);
}

export function getEventRemainingCapacity(event) {
  const remaining = Number(event?.capacity);
  return Number.isFinite(remaining) ? remaining : 0;
}

export function getEventTotalCapacity(event, registeredCount = 0) {
  const registered = Math.max(0, Number(registeredCount) || 0);
  const remaining = Number(event?.capacity);
  if (!Number.isFinite(remaining)) return null;
  return remaining + registered;
}

export function formatEventCapacity(event, registeredCount = 0) {
  const registered = Math.max(0, Number(registeredCount) || 0);
  const total = getEventTotalCapacity(event, registeredCount);
  if (!total) return `${registered}`;
  return `${registered}/${total}`;
}

export function getParticipantCounts(participants = []) {
  const list = Array.isArray(participants) ? participants : [];
  const registered = list.length;
  const scanned = list.filter((p) => p.is_visited).length;

  return {
    registered,
    scanned,
    pending: registered - scanned,
  };
}

export function resolveEventsError(err) {
  const status = err?.response?.status;
  if (status === 401) {
    return __DEV__
      ? 'Events API authentication failed (401). Sign in again so the app can send your Sanctum token.'
      : 'Events service is temporarily unavailable. Please try again later.';
  }
  if (status) {
    return `Could not load events (error ${status}). Please try again.`;
  }

  const message = String(err?.message || '');
  if (message.includes('is not set')) {
    return __DEV__
      ? 'Events API not configured. Set EXPO_PUBLIC_APP_URL and EXPO_PUBLIC_EVENTS_INFO_USE_PROXY in .env, then restart Expo.'
      : 'Events service is not available right now. Please try again later.';
  }
  if (message.toLowerCase().includes('network')) {
    return 'Network error. Check your connection and try again.';
  }
  return 'Could not load events. Please try again.';
}

export function mapValidationMessage(message) {
  const normalized = String(message || '').toLowerCase();
  if (normalized.includes('credentials match')) return 'success';
  if (normalized.includes('already participated')) return 'warning';
  if (normalized.includes('another event')) return 'error';
  if (normalized.includes('no such participant')) return 'error';
  return 'info';
}

export function normalizeParticipantEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function participantEmailsMatch(a, b) {
  const left = normalizeParticipantEmail(a);
  const right = normalizeParticipantEmail(b);
  return Boolean(left) && left === right;
}

export function findParticipantById(participants, participantId) {
  if (!Array.isArray(participants) || participantId == null) return null;
  return participants.find((p) => String(p.id) === String(participantId)) ?? null;
}

export function isSameEventId(a, b) {
  if (a == null || b == null) return false;
  return String(a).trim() === String(b).trim();
}

function formatParticipantTimestamp(value) {
  if (!value) return null;
  const parsed = typeof value === 'string' ? parseISO(value) : new Date(value);
  if (!isValid(parsed)) return String(value);
  return format(parsed, 'MMM d, yyyy · HH:mm');
}

const PARTICIPANT_DETAIL_FIELDS = [
  { key: 'phone', label: 'Phone' },
  { key: 'tel', label: 'Phone' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'code', label: 'Invitation code' },
  { key: 'company', label: 'Company' },
  { key: 'organization', label: 'Organization' },
  { key: 'job_title', label: 'Job title' },
  { key: 'city', label: 'City' },
  { key: 'address', label: 'Address' },
  { key: 'created_at', label: 'Registered on', format: formatParticipantTimestamp },
  { key: 'registered_at', label: 'Registered on', format: formatParticipantTimestamp },
  { key: 'updated_at', label: 'Last updated', format: formatParticipantTimestamp },
];

export function getParticipantDetailRows(participant) {
  if (!participant || typeof participant !== 'object') return [];

  const rows = [];
  const seenLabels = new Set();

  PARTICIPANT_DETAIL_FIELDS.forEach(({ key, label, format: formatValue }) => {
    const raw = participant[key];
    if (raw == null || raw === '') return;
    if (seenLabels.has(label)) return;

    const value = formatValue ? formatValue(raw) : String(raw);
    if (!value) return;

    rows.push({ label, value });
    seenLabels.add(label);
  });

  return rows;
}

// Finds other event registrations for the same email (orchestration — inject API fetchers).
export async function collectParticipantOtherRegistrations(
  email,
  excludeEventId,
  { getEvents, getEvent }
) {
  const normalizedEmail = normalizeParticipantEmail(email);
  if (!normalizedEmail || typeof getEvents !== 'function' || typeof getEvent !== 'function') {
    return [];
  }

  const listResponse = await getEvents();
  const events = normalizeEvents(listResponse?.data ?? []).filter(
    (event) => !isSameEventId(event.id, excludeEventId)
  );

  const matches = [];

  for (let index = 0; index < events.length; index += OTHER_EVENTS_BATCH_SIZE) {
    const batch = events.slice(index, index + OTHER_EVENTS_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (summary) => {
        if (isSameEventId(summary.id, excludeEventId)) return null;

        try {
          const response = await getEvent(summary.id);
          const event = response?.data?.event ?? summary;
          if (isSameEventId(event.id, excludeEventId)) return null;

          const participants = Array.isArray(response?.data?.participants)
            ? response.data.participants
            : [];
          const registration = participants.find((p) =>
            participantEmailsMatch(p.email, normalizedEmail)
          );
          if (!registration) return null;

          return { event, registration };
        } catch {
          return null;
        }
      })
    );

    matches.push(...batchResults.filter(Boolean));
  }

  const withoutCurrent = matches.filter((item) => !isSameEventId(item.event?.id, excludeEventId));

  return withoutCurrent.sort((a, b) => {
    const da = getEventDate(a.event)?.getTime() ?? 0;
    const db = getEventDate(b.event)?.getTime() ?? 0;
    return db - da;
  });
}
