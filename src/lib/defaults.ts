// Smart defaults for a one-gesture request: their court if it's in reach, else mine;
// the first slot where our availability overlaps, else their first slot.
import { nextSlot } from '@/data/demo';
import type { Player, Profile } from '@/data/types';

export function defaultProposal(me: Profile, them: Player) {
  const courtId = them.homeCourtId ?? me.homeCourtId!;
  const overlap = me.availabilityMask & them.availabilityMask;
  const start = nextSlot(overlap || them.availabilityMask || me.availabilityMask || 8, 1);
  const end = new Date(start.getTime() + 90 * 60000);
  return { courtId, start, end };
}

export { nextSlot };
