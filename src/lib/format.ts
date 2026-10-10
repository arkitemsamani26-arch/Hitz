export function levelBig(v: number | null | undefined): string {
  if (v == null) return '–';
  return v.toFixed(1);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayShort(d: Date): string {
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((d0 - t0) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return DAYS_LONG[d.getDay()];
  return `${DAYS[d.getDay()]} ${d.getDate()}`;
}

export function timeShort(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return m === 0 ? `${h}${ampm}` : `${h}:${String(m).padStart(2, '0')}${ampm}`;
}

export function windowText(start: Date, end: Date): string {
  return `${dayShort(start)} · ${timeShort(start)}–${timeShort(end)}`;
}

export function windowShout(start: Date): string {
  return `${DAYS[start.getDay()].toUpperCase()} ${timeShort(start).toUpperCase()}`;
}

// Compact form for list rows, where three facts have to fit on one line.
export function activeShort(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (h < 1) return 'Now';
  if (h < 24) return 'Today';
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return 'Quiet';
}

export function activeText(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = ms / 3600000;
  if (h < 1) return 'Active now';
  if (h < 24) return 'Active today';
  const d = Math.floor(h / 24);
  if (d === 1) return 'Active yesterday';
  if (d < 7) return `Active ${d}d ago`;
  if (d < 30) return `Active ${Math.floor(d / 7)}w ago`;
  return 'Quiet lately';
}

export function pct(v: number | null | undefined): string | null {
  if (v == null) return null;
  return `${Math.round(v * 100)}%`;
}

export function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function dayLong(d: Date): string { return DAYS_LONG[d.getDay()]; }
export function monthShort(d: Date): string { return MONTHS[d.getMonth()].toUpperCase(); }

// "Monday, October 12"
export function dateLong(d: Date): string { return `${DAYS_LONG[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`; }

// "6–7:30 pm". One suffix when both ends share it, with the space the reference uses.
export function rangeText(start: Date, end: Date): string {
  const a = timeShort(start), b = timeShort(end);
  const sa = a.slice(-2), sb = b.slice(-2);
  const sp = (x: string) => `${x.slice(0, -2)} ${x.slice(-2)}`;
  return sa === sb ? `${a.slice(0, -2)}–${sp(b)}` : `${sp(a)}–${sp(b)}`;
}

// The device's zone, in words where the words are common knowledge.
export function tzName(): string {
  let z = '';
  try { z = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''; } catch { /* no Intl */ }
  const known: Record<string, string> = {
    'America/Los_Angeles': 'Pacific time', 'America/Vancouver': 'Pacific time', 'America/Denver': 'Mountain time', 'America/Phoenix': 'Arizona time',
    'America/Chicago': 'Central time', 'America/New_York': 'Eastern time', 'America/Toronto': 'Eastern time', 'Europe/London': 'UK time',
  };
  if (known[z]) return known[z];
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName');
    return part?.value ?? '';
  } catch { return ''; }
}
