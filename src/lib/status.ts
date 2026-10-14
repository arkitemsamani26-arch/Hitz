// Where a hit stands, from where you sit: which list it belongs in on My hits, and the
// short label its pill shows everywhere.
import { expiresText } from './format';
import type { HitRequest } from '@/data/types';

export type Group = 'you' | 'them' | 'upcoming' | 'past';

export function groupOf(r: HitRequest, me: string | undefined): Group {
  if ((r.state === 'pending' || r.state === 'countered') && r.awaitingId === me) return 'you';
  if (r.state === 'pending' || r.state === 'countered') return 'them';
  if (r.state === 'accepted' || r.state === 'confirmed') return new Date(r.windowEnd) < new Date() ? 'past' : 'upcoming';
  return 'past';
}

export function statusOf(r: HitRequest, me: string | undefined): { label: string; icon: 'clock-3' | 'check' | 'x' | 'calendar-check-2' | 'users'; live?: boolean } {
  const who = r.other.displayName;
  switch (r.state) {
    case 'pending': return r.awaitingId === me ? { label: `Your reply · ${expiresText(r.expiresAt).toLowerCase()}`, icon: 'clock-3', live: true } : { label: `Awaiting ${who}'s reply`, icon: 'clock-3', live: true };
    case 'countered': return r.awaitingId === me ? { label: `${who} suggested another time`, icon: 'clock-3', live: true } : { label: `Awaiting ${who}'s reply to your new time`, icon: 'clock-3', live: true };
    case 'accepted': return { label: 'Waiting on a parent', icon: 'users', live: true };
    case 'confirmed': return { label: "It's on", icon: 'calendar-check-2', live: true };
    case 'completed': return { label: 'Played', icon: 'check' };
    case 'declined': return { label: r.awaitingId === null && r.fromId !== me ? 'You passed' : `${who} passed`, icon: 'x' };
    case 'cancelled': return { label: 'Cancelled', icon: 'x' };
    case 'expired': return { label: 'Expired', icon: 'x' };
  }
}
