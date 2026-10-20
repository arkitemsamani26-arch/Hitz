// Dates for tournaments, which are whole days with no time zone: "2026-10-24" is the 24th
// wherever you are, so they are read at local noon and never shifted.
import type { PlayFormat, Tournament } from '@/data/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function day(ymd: string): Date { return new Date(`${ymd.slice(0, 10)}T12:00:00`); }
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "Sat, Oct 24" or "Sat–Sun, Oct 24–25" or "Oct 31–Nov 1".
export function tournamentDates(t: Pick<Tournament, 'startsOn' | 'endsOn'>): string {
  const a = day(t.startsOn), b = day(t.endsOn);
  if (t.startsOn === t.endsOn) return `${DAYS[a.getDay()]}, ${MONTHS[a.getMonth()]} ${a.getDate()}`;
  const days = `${DAYS[a.getDay()]}–${DAYS[b.getDay()]}`;
  return a.getMonth() === b.getMonth()
    ? `${days}, ${MONTHS[a.getMonth()]} ${a.getDate()}–${b.getDate()}`
    : `${days}, ${MONTHS[a.getMonth()]} ${a.getDate()}–${MONTHS[b.getMonth()]} ${b.getDate()}`;
}

// Whole days from today to the first day; negative once it has started.
export function daysUntil(t: Pick<Tournament, 'startsOn'>): number {
  const today = day(ymd(new Date()));
  return Math.round((day(t.startsOn).getTime() - today.getTime()) / 86400000);
}

export function whenText(t: Pick<Tournament, 'startsOn' | 'endsOn'>): string {
  const n = daysUntil(t);
  if (n <= 0) return day(t.endsOn) >= day(ymd(new Date())) ? 'On now' : 'Over';
  if (n === 1) return 'Tomorrow';
  if (n < 7) return `In ${n} days`;
  const sat = day(t.startsOn).getDay() === 6 || day(t.startsOn).getDay() === 0;
  return n < 14 && sat ? 'Next weekend' : `In ${Math.round(n / 7)} week${Math.round(n / 7) === 1 ? '' : 's'}`;
}

// What you entered, said plainly: "16U · singles and doubles".
export function entryText(e: { division: string | null; singles: boolean; doubles: boolean }): string {
  const events = e.singles && e.doubles ? 'singles and doubles' : e.doubles ? 'doubles' : 'singles';
  return [e.division, events].filter(Boolean).join(' · ');
}

export const FORMAT_LABEL: Record<PlayFormat, string> = { singles: 'Singles', doubles: 'Doubles', either: 'Singles or doubles' };

// A practice before the tournament: the evening before its first day, if that is still
// ahead of us. Otherwise let the invitation pick its usual next window.
export function practiceBefore(t: Pick<Tournament, 'startsOn'>): { start: string; end: string } | null {
  const d = day(t.startsOn); d.setDate(d.getDate() - 1); d.setHours(17, 0, 0, 0);
  if (d.getTime() < Date.now() + 3 * 3600000) return null;
  return { start: d.toISOString(), end: new Date(d.getTime() + 90 * 60000).toISOString() };
}
