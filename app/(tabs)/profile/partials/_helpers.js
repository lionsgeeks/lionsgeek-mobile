import API from '@/api';

export function getLastExperience(profile) {
  const candidates =
    profile?.experiences ??
    profile?.experience ??
    profile?.user_experiences ??
    profile?.userExperiences ??
    [];

  const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  if (list.length === 0) return null;

  const score = (exp) => {
    const date =
      exp?.end_date ??
      exp?.endDate ??
      exp?.to ??
      exp?.until ??
      exp?.created_at ??
      exp?.createdAt ??
      exp?.updated_at ??
      exp?.updatedAt ??
      null;

    const ts = date ? new Date(date).getTime() : NaN;
    return Number.isFinite(ts) ? ts : -Infinity;
  };

  const sorted = [...list].sort((a, b) => score(b) - score(a));
  const best = sorted[0];
  return best ?? list[list.length - 1] ?? null;
}

export function normalizeSocialLinks(profile, fallbackList = []) {
  const fromProfile =
    profile?.social_links ??
    profile?.socialLinks ??
    profile?.social_links_list ??
    profile?.links ??
    null;

  const list = Array.isArray(fromProfile) ? fromProfile : Array.isArray(fallbackList) ? fallbackList : [];
  return list
    .filter(Boolean)
    .map((l) => ({
      id: l?.id ?? `${l?.title ?? ''}:${l?.url ?? ''}`,
      title: String(l?.title ?? l?.platform ?? '').toLowerCase(),
      url: String(l?.url ?? l?.link ?? '').trim(),
    }))
    .filter((l) => l.url.length > 0);
}

export function iconForSocialTitle(title) {
  const t = String(title ?? '').toLowerCase();
  if (t.includes('github')) return 'logo-github';
  if (t.includes('linkedin')) return 'logo-linkedin';
  if (t.includes('instagram')) return 'logo-instagram';
  if (t.includes('behance')) return 'color-palette-outline';
  if (t.includes('portfolio') || t.includes('website') || t.includes('site')) return 'globe-outline';
  return 'link-outline';
}

export function formatPeriod(startDate, endDate, isCurrent) {
  const fmt = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };
  const start = fmt(startDate);
  const end = isCurrent ? 'Present' : fmt(endDate);
  if (!start && !end) return null;
  if (!start) return end;
  if (!end) return start;
  return `${start} – ${end}`;
}

export function monthAbbr(month) {
  const m = Number(month);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!Number.isFinite(m) || m < 1 || m > 12) return null;
  return names[m - 1];
}

export function formatMonthYear(month, year) {
  const y = year != null ? String(year) : '';
  const m = monthAbbr(month);
  if (!m && !y) return null;
  if (!m) return y;
  if (!y) return m;
  return `${m} ${y}`;
}

export function formatPeriodFromParts(startMonth, startYear, endMonth, endYear, isCurrent) {
  const start = formatMonthYear(startMonth, startYear);
  const end = isCurrent ? 'Present' : formatMonthYear(endMonth, endYear);
  if (!start && !end) return null;
  if (!start) return end;
  if (!end) return start;
  return `${start} – ${end}`;
}

export function calcDuration(startDate, endDate, isCurrent) {
  const start = startDate ? new Date(startDate) : null;
  const end = isCurrent || !endDate ? new Date() : new Date(endDate);
  if (!start) return null;
  const totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (totalMonths < 1) return 'Less than a month';
  const years = Math.floor(totalMonths / 12);
  const mos = totalMonths % 12;
  return [
    years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : '',
    mos > 0 ? `${mos} mo` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function calcDurationFromParts(startMonth, startYear, endMonth, endYear, isCurrent) {
  const sm = Number(startMonth);
  const sy = Number(startYear);
  if (!Number.isFinite(sm) || !Number.isFinite(sy) || sm < 1 || sm > 12) return null;

  const end = (() => {
    if (isCurrent) return new Date();
    const em = Number(endMonth);
    const ey = Number(endYear);
    if (!Number.isFinite(em) || !Number.isFinite(ey) || em < 1 || em > 12) return null;
    return new Date(ey, em - 1, 1);
  })();

  const start = new Date(sy, sm - 1, 1);
  const effectiveEnd = end ?? new Date();
  const totalMonths =
    (effectiveEnd.getFullYear() - start.getFullYear()) * 12 +
    (effectiveEnd.getMonth() - start.getMonth());
  if (totalMonths < 1) return 'Less than a month';
  const years = Math.floor(totalMonths / 12);
  const mos = totalMonths % 12;
  return [
    years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : '',
    mos > 0 ? `${mos} mo` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export async function tryFetchFirstList({ token, endpoints }) {
  const listFrom = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    // common nested response shapes: { data: [...] } or { data: { education: [...] } }
    if (payload.data) {
      const nested = listFrom(payload.data);
      if (Array.isArray(nested) && nested.length >= 0) return nested;
    }
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.posts)) return payload.posts;
    if (Array.isArray(payload.feed)) return payload.feed;
    if (Array.isArray(payload.experiences)) return payload.experiences;
    if (Array.isArray(payload.education)) return payload.education;
    if (Array.isArray(payload.educations)) return payload.educations;
    if (Array.isArray(payload.experience)) return payload.experience;
    return [];
  };

  for (const endpoint of endpoints) {
    try {
      const res = await API.getWithAuth(endpoint, token, { silent: true });
      const list = listFrom(res?.data);
      if (Array.isArray(list)) return list;
    } catch (_err) {
      // Try next candidate endpoint
    }
  }
  return [];
}
