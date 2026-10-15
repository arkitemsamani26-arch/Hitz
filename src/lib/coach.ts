// How a coach's screen thinks about pairs: who on the roster would make a good hit, said in
// the reasons a coach would give, and where a pairing they made has got to.
import { slotsSummary, type CoachPairing, type RosterMember } from '@/data/types';

const key = (a: string, b: string) => [a, b].sort().join('|');

// Same side of 18, close in level, free at the same times, and for juniors close in age.
// The database decides what is allowed; this only ranks what is likely to be a good hit.
export function suggestPairs(active: RosterMember[], alreadyOpen: Set<string>): [RosterMember, RosterMember][] {
  const out: { a: RosterMember; b: RosterMember; score: number }[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      if (a.band !== b.band || alreadyOpen.has(key(a.id, b.id))) continue;
      if (a.levelValue == null || b.levelValue == null) continue;
      const gap = Math.abs(a.levelValue - b.levelValue);
      if (gap > 1.0) continue;
      const ageGap = a.age != null && b.age != null ? Math.abs(a.age - b.age) : 0;
      if (ageGap > 2) continue;
      const overlap = (a.availabilityMask & b.availabilityMask) !== 0;
      out.push({ a, b, score: gap + (overlap ? 0 : 0.6) + ageGap * 0.2 - (a.lookingToHit && b.lookingToHit ? 0.2 : 0) });
    }
  }
  // Spread the suggestions around: nobody appears in more than two.
  const used = new Map<string, number>();
  return out.sort((x, y) => x.score - y.score).filter(x => {
    const n = Math.max(used.get(x.a.id) ?? 0, used.get(x.b.id) ?? 0);
    if (n >= 2) return false;
    used.set(x.a.id, (used.get(x.a.id) ?? 0) + 1); used.set(x.b.id, (used.get(x.b.id) ?? 0) + 1);
    return true;
  }).map(x => [x.a, x.b]);
}

export function pairReasons(a: RosterMember, b: RosterMember): string[] {
  const out: string[] = [];
  if (a.levelValue != null && b.levelValue != null) {
    const gap = Math.abs(a.levelValue - b.levelValue);
    out.push(gap < 0.05 ? 'Same rating' : `${gap.toFixed(1)} apart`);
  }
  const both = a.availabilityMask & b.availabilityMask;
  if (both) out.push(`both free ${slotsSummary(both).toLowerCase()}`);
  else out.push('different free times');
  if (a.age != null && b.age != null) out.push(a.age === b.age ? `both ${a.age}` : `${a.age} and ${b.age}`);
  if (a.lookingToHit && b.lookingToHit) out.push('both looking this week');
  return out;
}

export function pairingStatus(x: CoachPairing): { label: string; icon: 'clock-3' | 'check' | 'x' | 'calendar-check-2' | 'users' | 'send'; good?: boolean } {
  if (x.state === 'dismissed') return { label: 'Not now', icon: 'x' };
  if (x.state === 'open') return { label: 'Sent to both', icon: 'send' };
  switch (x.hitState) {
    case 'pending': case 'countered': return { label: 'Invite sent', icon: 'clock-3' };
    case 'accepted': return { label: 'With the parents', icon: 'users' };
    case 'confirmed': return { label: "It's on", icon: 'calendar-check-2', good: true };
    case 'completed': return { label: 'Played', icon: 'check', good: true };
    case 'declined': return { label: 'Passed', icon: 'x' };
    case 'cancelled': case 'expired': return { label: 'Fell through', icon: 'x' };
    default: return { label: 'Invite sent', icon: 'clock-3' };
  }
}
