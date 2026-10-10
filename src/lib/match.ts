// The sentences on a player card: what we can honestly say about when you are both free,
// how far apart your levels are, and why this person is here.
//
// Availability is a coarse weekly pattern (weekday / weekend × morning / afternoon /
// evening). It is never a promise about one particular hour, so the strongest claim the
// card makes is "both usually free Monday evenings". A window outside anything the other
// player has said about their week gets "Ask Elena about", not a claim.
import { dayLong, dayShort, rangeText } from './format';
import type { Player, Profile } from '@/data/types';
import type { Window } from '@/store/window';

export function slotBit(d: Date): number {
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  const h = d.getHours();
  const part = h < 12 ? 0 : h < 17 ? 1 : 2;
  return (weekend ? 8 : 1) << part;
}
export function partOf(d: Date): 'morning' | 'afternoon' | 'evening' {
  const h = d.getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
export function endOf(w: Window): Date { return new Date(w.start.getTime() + w.durMin * 60000); }

export function overlapLine(me: Pick<Profile, 'availabilityMask'>, p: Player, w: Window): { text: string; known: boolean } {
  const bit = slotBit(w.start);
  const both = (me.availabilityMask & p.availabilityMask & bit) !== 0;
  const theirs = (p.availabilityMask & bit) !== 0;
  const when = `${dayLong(w.start)} ${partOf(w.start)}s`;
  if (both) return { text: `Both usually free ${when}`, known: true };
  if (theirs) return { text: `${p.displayName} is usually free ${when}`, known: true };
  if (p.availabilityMask === 0) return { text: `Propose a time to ${p.displayName}`, known: false };
  return { text: `Ask ${p.displayName} about ${dayShort(w.start)}, ${rangeText(w.start, endOf(w))}`, known: false };
}

export function gapOf(me: Pick<Profile, 'levelValue'>, p: Player): number | null {
  return me.levelValue != null && p.levelValue != null ? Math.abs(p.levelValue - me.levelValue) : null;
}

// "0.2 UTR apart", for a chip.
export function gapShort(me: Pick<Profile, 'levelValue'>, p: Player): string | null {
  const gap = gapOf(me, p);
  if (gap == null) return null;
  return gap < 0.05 ? 'Same rating' : `${gap.toFixed(1)} UTR apart`;
}

export function gapLine(me: Pick<Profile, 'levelValue'>, p: Player): string {
  const gap = gapOf(me, p);
  if (gap == null) return 'Level not set yet. Ask how they play.';
  if (gap < 0.05) return 'Same rating. An even hit.';
  const tail = gap <= 0.5 ? 'A natural place to start.' : gap <= 1 ? 'Close enough for good sets.' : 'A stretch, in a good way.';
  return `${gap.toFixed(1)} UTR apart. ${tail}`;
}

function milesOf(bucket: string | null): number | null {
  if (!bucket) return null;
  const m = bucket.match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

// The small line above the name. Only facts that are true of this person.
export function tagLine(me: Pick<Profile, 'levelValue'>, p: Player): string {
  const parts: string[] = [];
  const gap = gapOf(me, p);
  if (gap != null && gap < 1) parts.push('Near your level');
  const mi = milesOf(p.distanceBucket);
  if (mi != null && mi <= 5) parts.push('Near you');
  if (p.lookingToHit) parts.push('Looking this week');
  // Two facts fit on the line; a third wraps it.
  return parts.length ? parts.slice(0, 2).join(' · ') : 'Around your area';
}

// "Palo Alto · Practice sets" in the reference. We know a home court and a distance, not a
// city, so it is the court when there is one.
export function metaLine(p: Player): string {
  return [p.homeCourtName ?? (p.distanceBucket ? `${p.distanceBucket} away` : null), p.prefers].filter(Boolean).join(' · ');
}
