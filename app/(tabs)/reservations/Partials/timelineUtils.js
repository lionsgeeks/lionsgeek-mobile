export const TIMELINE_HOUR_HEIGHT = 80;
export const TIMELINE_START_MINUTES = 7 * 60 + 30; // 07:30
export const TIMELINE_END_MINUTES = 17 * 60 + 30; // 17:30
export const TIMELINE_SNAP_MINUTES = 15;
export const TIMELINE_MIN_DURATION = 30;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function snapMinutes(minutes, snap = TIMELINE_SNAP_MINUTES) {
  return Math.round(minutes / snap) * snap;
}

export function getTimelineTotalHeight(
  hourHeight = TIMELINE_HOUR_HEIGHT,
  startMin = TIMELINE_START_MINUTES,
  endMin = TIMELINE_END_MINUTES,
) {
  return ((endMin - startMin) * hourHeight) / 60;
}

export function yToMinutes(
  y,
  totalHeight,
  startMin = TIMELINE_START_MINUTES,
  endMin = TIMELINE_END_MINUTES,
  snap = TIMELINE_SNAP_MINUTES,
) {
  if (totalHeight <= 0) return startMin;
  const ratio = clamp(y / totalHeight, 0, 1);
  const raw = startMin + ratio * (endMin - startMin);
  return clamp(snapMinutes(raw, snap), startMin, endMin);
}

export function minutesToY(
  minutes,
  hourHeight = TIMELINE_HOUR_HEIGHT,
  startMin = TIMELINE_START_MINUTES,
) {
  return ((minutes - startMin) * hourHeight) / 60;
}

export function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

export function buildSelectionRange(anchorMin, currentMin) {
  let startMin = Math.min(anchorMin, currentMin);
  let endMin = Math.max(anchorMin, currentMin);

  if (endMin - startMin < TIMELINE_MIN_DURATION) {
    if (currentMin >= anchorMin) {
      endMin = startMin + TIMELINE_MIN_DURATION;
    } else {
      startMin = endMin - TIMELINE_MIN_DURATION;
    }
  }

  startMin = clamp(startMin, TIMELINE_START_MINUTES, TIMELINE_END_MINUTES - TIMELINE_MIN_DURATION);
  endMin = clamp(endMin, startMin + TIMELINE_MIN_DURATION, TIMELINE_END_MINUTES);

  return { startMin, endMin };
}

export function selectionToTimeRange(selection) {
  if (!selection) return null;
  return {
    start: minutesToTimeString(selection.startMin),
    end: minutesToTimeString(selection.endMin),
  };
}

export function hasSlotConflict(selection, occupiedSlots = []) {
  if (!selection) return false;
  return occupiedSlots.some(
    (slot) =>
      !slot.canceled &&
      rangesOverlap(selection.startMin, selection.endMin, slot.startMin, slot.endMin),
  );
}
