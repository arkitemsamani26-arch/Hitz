// The reference's sample data, kept apart from the product. Rendered only by the design
// preview, so the real screens never show a person who does not exist.
import type { Player, Profile } from './types';
import type { Window } from '@/store/window';

const EVENINGS = 4 | 32; // weekday and weekend evenings

export const CLUBHOUSE = {
  // An illustrative current player.
  me: {
    id: 'fixture-arki', displayName: 'Arki', lastInitial: 'T', photoUrl: null, band: 'adult', levelValue: 10.5, levelSource: 'utr_self',
    homeCourtId: 'c-rinconada', availabilityMask: EVENINGS, lastActiveAt: new Date().toISOString(), lookingToHitUntil: null,
    responseRate: null, acceptRate: null, hitsConfirmed: 0, phoneVerified: true, guardianVerified: false, guardianPending: false,
    guardianSentAt: null, guardianOpenedAt: null, rosterName: null, prefers: 'Rally & practice sets',
  } as Profile,
  elena: {
    id: 'fixture-elena', displayName: 'Elena', lastInitial: 'R', photoUrl: null, levelValue: 10.3, levelSource: 'utr_self', levelVerified: false,
    levelDelta: 0.2, distanceBucket: '~1 mi', homeCourtId: 'c-rinconada', homeCourtName: 'Palo Alto', availabilityMask: EVENINGS,
    lookingToHit: true, lastActiveAt: new Date().toISOString(), responseRate: null, acceptRate: null, hitsConfirmed: 0, prefers: 'Practice sets',
  } as Player,
  kenji: {
    id: 'fixture-kenji', displayName: 'Kenji', lastInitial: 'O', photoUrl: null, levelValue: 9.6, levelSource: 'utr_self', levelVerified: false,
    levelDelta: 0.9, distanceBucket: '~3 mi', homeCourtId: 'c-rinconada', homeCourtName: 'Palo Alto', availabilityMask: 4,
    lookingToHit: false, lastActiveAt: new Date().toISOString(), responseRate: null, acceptRate: null, hitsConfirmed: 0, prefers: 'Rally & drills',
  } as Player,
  // Monday, October 12, 2026, 6 to 7:30 pm, in the device's zone.
  win: { start: new Date(2026, 9, 12, 18, 0, 0, 0), durMin: 90 } as Window,
  court: 'Rinconada Park',
  area: 'Palo Alto',
};
