// Smart defaults for a one-gesture request: their court if it's in reach, else mine;
// the first slot where our availability overlaps, else their first slot.
import { nextSlot } from '@/data/demo';
import { midpointCourt } from '@/lib/courts';
import type { Player, Profile } from '@/data/types';

// Meet in the middle when we can, so neither of you drives the whole way.
export function defaultProposal(me: Profile, them: Player, courtIds?: string[]) {
  const middle = courtIds?.length ? midpointCourt(me.homeCourtId, them.homeCourtId, courtIds) : null;
  // Somewhere to play is not optional. Neither side having a home court is possible, so
  // fall back to the directory rather than sending court_id: undefined.
  const courtId = middle ?? them.homeCourtId ?? me.homeCourtId ?? courtIds?.[0] ?? null;
  if (!courtId) throw new Error('Pick a court first.');
  const overlap = me.availabilityMask & them.availabilityMask;
  const start = nextSlot(overlap || them.availabilityMask || me.availabilityMask || 8, 1);
  const end = new Date(start.getTime() + 90 * 60000);
  return { courtId, start, end };
}

/**
 * The one we'd pick for you. Level first, then whether they're actually looking, then
 * whether your weeks overlap, then how recently they showed up.
 */
export function bestMatch(me: Profile, players: Player[]): Player | null {
  if (!players.length) return null;
  const mine = me.levelValue ?? 0;
  const score = (p: Player) => {
    const gap = Math.abs((p.levelValue ?? mine) - mine);
    let n = 100 - gap * 22;
    if (p.lookingToHit) n += 18;
    if (me.availabilityMask & p.availabilityMask) n += 12;
    const days = (Date.now() - new Date(p.lastActiveAt).getTime()) / 86400000;
    n -= Math.min(days, 14);
    if (p.responseRate != null) n += p.responseRate * 8;
    return n;
  };
  return [...players].sort((a, b) => score(b) - score(a))[0];
}

/** Why we picked them, in a few words. */
export function matchReason(me: Profile, p: Player): string {
  const gap = me.levelValue != null && p.levelValue != null ? Math.abs(p.levelValue - me.levelValue) : null;
  if (gap != null && gap < 0.4) return 'Dead even with you';
  if (p.lookingToHit) return 'Looking to hit this week';
  if (me.availabilityMask & p.availabilityMask) return 'Free when you are';
  if (gap != null && gap < 1) return 'Half a point off you';
  return 'Close to your level';
}

export { nextSlot };
