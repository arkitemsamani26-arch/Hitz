export function levelText(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toFixed(2).replace(/0$/, '').replace(/\.$/, '.0');
}

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
