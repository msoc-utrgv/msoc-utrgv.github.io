// Date and time formatting for values stored as "YYYY-MM-DD" and "HH:MM".

const dateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/** Parse as a local date; new Date("YYYY-MM-DD") would be UTC and can shift the day. */
export function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return match ? new Date(+match[1], +match[2] - 1, +match[3]) : null;
}

export function formatDate(value) {
  const date = parseDate(value);
  return date ? dateFormat.format(date) : '';
}

export function formatTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  return match ? timeFormat.format(new Date(2000, 0, 1, +match[1], +match[2])) : '';
}

export function formatTimeRange(start, end) {
  return [formatTime(start), formatTime(end)].filter(Boolean).join(' – ');
}

/** A dated item is past once its day is over. */
export function isPast(value, now = new Date()) {
  const date = parseDate(value);
  if (!date) return false;
  date.setDate(date.getDate() + 1);
  return date <= now;
}
