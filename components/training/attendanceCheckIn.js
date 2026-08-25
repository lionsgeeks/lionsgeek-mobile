import API from '@/api';
import { getUserRolesNormalized } from '@/components/helpers/helpers';

export const STAFF_ROLES = ['admin', 'super_admin', 'coach', 'moderateur', 'studio_responsable'];

export const NETWORK_RESTRICTED_FALLBACK =
  "You're not on school WiFi. Connect to school WiFi to check in.";
export const CHECKIN_RESTRICTED_FALLBACK = 'Connect to school WiFi to check in, then try again.';
export const CHECKIN_UNAVAILABLE_TITLE = 'Check-In Unavailable';
export const CHECKIN_UNAVAILABLE_MESSAGE =
  'Attendance check-in is temporarily unavailable. Please contact a staff member.';
export const CHECKIN_UNAVAILABLE_BANNER =
  'Attendance check-in is temporarily unavailable. Contact staff.';

/** CTA labels aligned with SLOT_SHORT_LABELS (same slot → same display name). */
export const SLOT_ACTION_LABELS = {
  morning: 'Mark morning attendance',
  lunch: 'Mark coffee break attendance',
  evening: 'Mark lunch attendance',
};

export const SLOT_SHORT_LABELS = {
  morning: 'Morning 9:30-11:00',
  lunch: 'Coffee break 11:30-13:00',
  evening: 'Lunch 14:00-17:00',
};

export function getApiMessage(error, fallback) {
  const message = error?.response?.data?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function isStaffUser(user) {
  const roles = getUserRolesNormalized(user);
  return roles.some((role) => STAFF_ROLES.includes(role));
}

export function isStudentUser(user) {
  return Boolean(user && !isStaffUser(user));
}

export function getSlotActionLabel(slot) {
  const key = normalizeSlotKey(slot);
  if (!key) return 'Mark attendance';
  return SLOT_ACTION_LABELS[key] ?? 'Mark attendance';
}

export function getSlotShortLabel(slot) {
  const key = normalizeSlotKey(slot);
  if (key && SLOT_SHORT_LABELS[key]) return SLOT_SHORT_LABELS[key];
  if (typeof key === 'string' && key) return key;
  if (slot && typeof slot === 'object') {
    const label = pickFirst(slot.label, slot.title, slot.display_name);
    if (typeof label === 'string' && label.trim()) return label.trim();
  }
  if (typeof slot === 'string' && slot) return slot;
  return 'Attendance';
}

export const PRESENT_WINDOW_MINUTES = 15;

export function getReminderSlotKey(slotStatus) {
  const slot = slotStatus?.current_slot;
  const day = slotStatus?.attendance_day;
  if (!slot || !day) return null;
  return `${slot}-${day}`;
}

/** Present vs late sub-phase within an active slot (derived from minutes_into_slot). */
export function getAttendanceReminderPhase(slotStatus) {
  const { minutes_into_slot } = slotStatus ?? {};
  if (typeof minutes_into_slot !== 'number' || minutes_into_slot < 0) return null;
  return minutes_into_slot < PRESENT_WINDOW_MINUTES ? 'present' : 'late';
}

/** Per-slot-per-phase dismiss key, e.g. morning-2026-07-01-present. */
export function getReminderDismissKey(slotStatus) {
  const slotKey = getReminderSlotKey(slotStatus);
  const phase = getAttendanceReminderPhase(slotStatus);
  if (!slotKey || !phase) return null;
  return `${slotKey}-${phase}`;
}

/** Single source of truth for reminder banner visibility (full active slot, unmarked). */
export function shouldShowAttendanceReminder(slotStatus) {
  if (!slotStatus) return false;

  const { phase, current_slot, already_marked_slots = [] } = slotStatus;
  const normalizedPhase = String(phase ?? '').replace(/-/g, '_');
  if (normalizedPhase !== 'active' || !current_slot) return false;

  const marked = Array.isArray(already_marked_slots) ? already_marked_slots : [];
  if (marked.includes(current_slot)) return false;

  return getAttendanceReminderPhase(slotStatus) != null;
}

export function shouldShowReminderBanner(slotStatus, dismissedDismissKey) {
  if (!shouldShowAttendanceReminder(slotStatus)) return false;
  const dismissKey = getReminderDismissKey(slotStatus);
  if (!dismissKey || dismissedDismissKey === dismissKey) return false;
  return true;
}

export function getAttendanceReminderBannerText(slotStatus) {
  const slot = slotStatus?.current_slot;
  if (!slot) return '';

  const label = getSlotShortLabel(slot);
  const reminderPhase = getAttendanceReminderPhase(slotStatus);

  if (reminderPhase === 'present') {
    return `${label} attendance is open — tap to mark your presence.`;
  }
  if (reminderPhase === 'late') {
    return `You're late for ${label} — tap to mark before the window closes.`;
  }
  return '';
}

/** In-screen reminder copy (check-in page) — countdown when minutes are known. */
export function getCheckInReminderBannerText(slotStatus) {
  const reminderPhase = getAttendanceReminderPhase(slotStatus);
  if (!reminderPhase) return '';

  const { minutes_into_slot } = slotStatus ?? {};
  if (reminderPhase === 'present' && typeof minutes_into_slot === 'number') {
    const minutesLeft = Math.max(0, Math.ceil(PRESENT_WINDOW_MINUTES - minutes_into_slot));
    if (minutesLeft <= 0) return "Time to mark — you're in the present window.";
    return `${minutesLeft} min left to be marked present`;
  }
  if (reminderPhase === 'late') {
    return "You're late — mark before the window closes";
  }
  return '';
}

function formatStatusWord(status) {
  if (status === 'present') return 'Present';
  if (status === 'late') return 'Late';
  if (status === 'absent') return 'Absent';
  return null;
}

/** Format a clock time from API strings/dates when present; never invent times. */
export function formatClockTime(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && !(value instanceof Date)) {
    const nested = pickFirst(value.time, value.formatted, value.at, value.opens_at, value.start);
    return nested != null ? formatClockTime(nested) : null;
  }
  if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value.trim())) {
    return value.trim().slice(0, 5);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function pickFirst(...values) {
  for (const value of values) {
    if (value != null && value !== '') return value;
  }
  return null;
}

/** Slot slug (morning|lunch|evening) from a string key or nested API object. */
function normalizeSlotKey(slot) {
  if (slot == null || slot === '') return null;
  if (typeof slot === 'string') return slot;
  if (typeof slot === 'object') {
    return pickFirst(slot.slot, slot.key, slot.name, slot.id);
  }
  return null;
}

function getSlotOpenTimeFromRef(slotRef) {
  if (slotRef == null || typeof slotRef !== 'object') return null;
  return pickFirst(
    slotRef.opens_at,
    slotRef.start,
    slotRef.start_time,
    slotRef.slot_start,
    slotRef.opens,
  );
}

/** "Coffee break · 11:30-14:00" when slot window times exist on the payload. */
export function getSessionRangeLabel(slotStatus) {
  if (!slotStatus?.current_slot) return null;
  const label = getSlotShortLabel(slotStatus.current_slot);
  const start = formatClockTime(
    pickFirst(
      slotStatus.slot_start,
      slotStatus.window_start,
      slotStatus.current_slot_start,
      slotStatus.starts_at,
    ),
  );
  const end = formatClockTime(
    pickFirst(slotStatus.slot_end, slotStatus.window_end, slotStatus.current_slot_end, slotStatus.ends_at),
  );
  if (start && end) return `${label} · ${start}-${end}`;
  if (start) return `${label} · from ${start}`;
  return label;
}

function getUpcomingOpenTime(slotStatus) {
  const nextRef = slotStatus?.next_slot ?? slotStatus?.upcoming_slot;
  return formatClockTime(
    pickFirst(
      slotStatus?.next_slot_start,
      slotStatus?.upcoming_slot_start,
      slotStatus?.opens_at,
      slotStatus?.next_opens_at,
      getSlotOpenTimeFromRef(typeof nextRef === 'object' ? nextRef : null),
    ),
  );
}

function getMinutesUntilNext(slotStatus) {
  const raw = pickFirst(slotStatus?.minutes_until_next, slotStatus?.minutes_until_open);
  if (typeof raw === 'number' && raw >= 0) return Math.ceil(raw);
  return null;
}

function getMarkedAtLabel(lastCheckInResult, slotStatus) {
  const time = formatClockTime(
    pickFirst(
      lastCheckInResult?.marked_at,
      lastCheckInResult?.checked_in_at,
      lastCheckInResult?.time,
      slotStatus?.marked_at,
      slotStatus?.checked_in_at,
    ),
  );
  return time;
}

function baseUi(overrides) {
  return {
    mode: 'out_of_hours',
    label: 'No attendance to mark right now',
    primaryLine: 'No attendance to mark right now',
    secondaryLine: '',
    helperText: '',
    helperTone: 'hint',
    icon: 'moon-outline',
    iconTone: 'neutral',
    showReminderBanner: false,
    reminderBannerText: '',
    sessionRangeLabel: null,
    nextSlotBanner: null,
    actionable: false,
    disabled: true,
    mutedCta: false,
    ...overrides,
  };
}

/**
 * Slot-derived UI for the check-in screen (and shared consumers).
 * Modes: loading | ready | marked | upcoming | out_of_hours
 */
export function deriveButtonUi(slotStatus, { lastCheckInResult = null } = {}) {
  if (!slotStatus) {
    return baseUi({
      mode: 'loading',
      label: 'Loading…',
      primaryLine: 'Loading…',
      icon: 'hourglass-outline',
      iconTone: 'neutral',
    });
  }

  const {
    phase,
    current_slot,
    next_slot,
    upcoming_slot,
    already_marked_slots = [],
  } = slotStatus;
  const normalizedPhase = String(phase ?? '').replace(/-/g, '_');
  const marked = Array.isArray(already_marked_slots) ? already_marked_slots : [];
  const currentMarked = current_slot && marked.includes(current_slot);
  const upcomingSlotRef = next_slot ?? upcoming_slot;
  const upcomingSlotKey = normalizeSlotKey(upcomingSlotRef);

  if (normalizedPhase === 'out_of_hours') {
    const nextLabel = upcomingSlotRef ? getSlotShortLabel(upcomingSlotRef) : null;
    const nextOpen = getUpcomingOpenTime(slotStatus);
    return baseUi({
      mode: 'out_of_hours',
      label: 'No attendance to mark right now',
      primaryLine: 'No attendance to mark right now',
      secondaryLine: "Today's sessions have ended",
      helperText:
        nextLabel && nextOpen
          ? `Next session: ${nextLabel.toLowerCase()}, ${nextOpen}.`
          : nextOpen
            ? `Next session: ${nextOpen}.`
            : '',
      icon: 'moon-outline',
      iconTone: 'neutral',
    });
  }

  if (normalizedPhase === 'gap') {
    const upcomingLabel = upcomingSlotRef ? getSlotShortLabel(upcomingSlotRef) : null;
    const openTime = getUpcomingOpenTime(slotStatus);
    const minutesUntil = getMinutesUntilNext(slotStatus);

    let primaryLine = upcomingLabel ? `${upcomingLabel} coming up` : 'Waiting for next window';
    if (upcomingLabel && openTime) {
      primaryLine = `${upcomingLabel} opens at ${openTime}`;
    }

    let secondaryLine = 'The attendance window is not open yet.';
    if (typeof minutesUntil === 'number') {
      secondaryLine = minutesUntil === 1 ? 'In 1 minute' : `In ${minutesUntil} minutes`;
    }

    return baseUi({
      mode: 'upcoming',
      label: upcomingSlotKey ? getSlotActionLabel(upcomingSlotRef) : 'Waiting for next window',
      primaryLine,
      secondaryLine,
      helperText: 'You can check in once the window opens.',
      icon: 'time-outline',
      iconTone: 'neutral',
    });
  }

  if (normalizedPhase === 'active' && current_slot) {
    if (currentMarked) {
      const slotLabel = getSlotShortLabel(current_slot);
      const resultSlot = lastCheckInResult?.slot ?? lastCheckInResult?.current_slot;
      const resultMatches =
        !resultSlot || resultSlot === current_slot || getSlotShortLabel(resultSlot) === slotLabel;
      const statusWord = resultMatches ? formatStatusWord(lastCheckInResult?.status) : null;
      const markedAt = getMarkedAtLabel(lastCheckInResult, slotStatus);

      let secondaryLine = 'Your attendance for this period is recorded.';
      if (statusWord && markedAt) {
        secondaryLine = `${statusWord} · marked at ${markedAt}`;
      } else if (statusWord) {
        secondaryLine = statusWord;
      } else if (markedAt) {
        secondaryLine = `Marked at ${markedAt}`;
      }
      
      const nextLabel = upcomingSlotRef ? getSlotShortLabel(upcomingSlotRef) : null;
      const nextOpen = getUpcomingOpenTime(slotStatus);
      const nextSlotBanner =
        nextLabel || nextOpen
          ? {
              left: nextLabel ? `Next: ${nextLabel}` : 'Next slot',
              right: nextOpen ? `Opens ${nextOpen}` : '',
            }
          : null;

      return baseUi({
        mode: 'marked',
        label: `${slotLabel} Marked ✓`,
        primaryLine: `${slotLabel} marked`,
        secondaryLine,
        helperText: '',
        icon: 'checkmark-circle',
        iconTone: 'success',
        nextSlotBanner,
      });
    }

    const showReminderBanner = shouldShowAttendanceReminder(slotStatus);

    return baseUi({
      mode: 'ready',
      label: getSlotActionLabel(current_slot),
      primaryLine: getSlotActionLabel(current_slot),
      secondaryLine: '',
      helperText: 'Connect to school wifi to check in.',
      icon: 'location-outline',
      iconTone: 'action',
      showReminderBanner,
      reminderBannerText: showReminderBanner ? getCheckInReminderBannerText(slotStatus) : '',
      sessionRangeLabel: getSessionRangeLabel(slotStatus),
      actionable: true,
      disabled: false,
    });
  }

  return baseUi({
    mode: 'out_of_hours',
    secondaryLine: "Today's sessions have ended",
  });
}

/**
 * Full check-in screen UI: slot state + network + fetch error overlays.
 */
export function deriveCheckInScreenUi(
  slotStatus,
  { networkStatus = null, slotFetchError = false, lastCheckInResult = null } = {},
) {
  if (slotFetchError) {
    return baseUi({
      mode: 'error',
      label: "Couldn't load attendance status",
      primaryLine: "Couldn't load attendance status",
      secondaryLine: '',
      helperText: '',
      icon: 'warning-outline',
      iconTone: 'warning',
    });
  }

  const ui = deriveButtonUi(slotStatus, { lastCheckInResult });

  if (ui.mode === 'ready' && (networkStatus === 'restricted' || networkStatus === 'unavailable')) {
    return {
      ...ui,
      mutedCta: true,
      helperTone: 'danger',
      helperText:
        networkStatus === 'unavailable'
          ? CHECKIN_UNAVAILABLE_BANNER
          : 'Connect to school wifi to check in.',
    };
  }

  if (ui.mode === 'ready' && networkStatus === 'ok') {
    return {
      ...ui,
      helperTone: 'hint',
      helperText: 'You are on school wifi. Tap to check in.',
    };
  }

  if (ui.mode === 'ready' && networkStatus === 'checking') {
    return {
      ...ui,
      mutedCta: true,
      helperTone: 'hint',
      helperText: 'Checking school wifi…',
    };
  }

  return ui;
}

export function formatCheckInSuccessMessage(data) {
  const slot = data?.slot ?? data?.current_slot;
  const status = data?.status;
  const slotName = getSlotShortLabel(slot);
  const statusWord = formatStatusWord(status);

  if (statusWord && slotName) {
    return `You have been marked as ${statusWord} for the ${slotName} period.`;
  }
  if (typeof data?.message === 'string' && data.message.trim()) {
    return data.message.trim();
  }
  return 'Your attendance has been marked successfully.';
}

export async function fetchSlotStatus(token, formationId) {
  const response = await API.getWithAuth(
    `mobile/attendance/slot-status?formation_id=${encodeURIComponent(String(formationId))}`,
    token,
  );
  return response?.data ?? null;
}

export async function submitCheckIn(token, { formation_id, attendance_day }) {
  const response = await API.postWithAuth(
    'mobile/attendance/check-in',
    { formation_id, attendance_day },
    token,
  );
  return response?.data ?? null;
}

export async function checkAttendanceNetwork(token) {
  await API.getWithAuth('mobile/attendance/network-check', token);
}
