// Hits Plus, the one paid plan. The server decides every limit and says so with an error
// whose message starts `plus_required:<why>`; this turns that into the paywall.
import type { Handedness, PlayStyle } from '@/data/types';

export const PLUS_PRICE = '$4.99';
export const PLUS_PERIOD = 'month';
export const PLUS_PRODUCT = 'hits_plus_monthly';
export const PLUS_ENTITLEMENT = 'plus';

export type PlusWhy = 'invites' | 'filters' | 'card' | 'stats' | 'notes' | 'searches' | 'automatch' | 'looking';

// What each limit opens the paywall with.
export const PLUS_WHY: Record<PlusWhy, string> = {
  invites: 'Three invitations are out and waiting on a reply. Plus sends as many as you like.',
  filters: 'Playing style, hand, reply rate, indoor courts and singles-or-doubles are Plus filters.',
  card: 'Your playing style, hand, a line about you and an action photo are part of Plus.',
  stats: 'Your hits over time, who you play most and your level trend are part of Plus.',
  notes: 'Private notes on your partners, only you can see, are part of Plus.',
  searches: 'Saved searches, and a push when someone new fits, are part of Plus.',
  automatch: 'Auto-match: Hits invites players for you, one at a time, until one says yes.',
  looking: 'Free shows the five best fits looking this week. Plus shows everyone.',
};

export const PLUS_BENEFITS: { title: string; sub: string; icon: 'send' | 'sliders-horizontal' | 'zap' | 'users-round' | 'trophy' | 'bell' | 'pencil' | 'id-card' }[] = [
  { icon: 'zap', title: 'Auto-match', sub: 'Say when and who; Hits sends the invitations, one at a time, until one says yes.' },
  { icon: 'send', title: 'Unlimited invitations', sub: 'Free keeps three waiting on a reply at once.' },
  { icon: 'sliders-horizontal', title: 'Every filter', sub: 'Playing style, lefty or righty, reply rate, indoor courts, singles or doubles.' },
  { icon: 'users-round', title: 'Everyone free this week', sub: 'The whole list, with their week next to yours. Free sees the top five.' },
  { icon: 'bell', title: 'Saved searches with alerts', sub: 'A push when a new player who fits joins near you.' },
  { icon: 'trophy', title: 'Your stats', sub: 'Hits per month, who you play most, your level over time.' },
  { icon: 'pencil', title: 'Private partner notes', sub: '"Big forehand, likes two-hour sets." Only you see them.' },
  { icon: 'id-card', title: 'A fuller card', sub: 'Your style, your hand, a line about you, an action photo, and the Plus badge.' },
];

export function plusWhy(e: unknown): PlusWhy | null {
  const m = /plus_required:([a-z]+)/.exec(String((e as any)?.message ?? e ?? ''));
  return (m?.[1] as PlusWhy) ?? null;
}
export function isPlusError(e: unknown): boolean { return plusWhy(e) != null; }

// The message with the marker taken off, for a toast.
export function plainMessage(e: unknown): string {
  return String((e as any)?.message ?? e ?? '').replace(/plus_required:[a-z]+\s*/, '').trim();
}

export const PLAY_STYLE_LABEL: Record<PlayStyle, string> = {
  baseliner: 'Baseliner', all_court: 'All-court', serve_volley: 'Serve and volley', counterpuncher: 'Counterpuncher',
};
export const HAND_LABEL: Record<Handedness, string> = { left: 'Lefty', right: 'Righty' };

export function plusLine(p: { playStyle?: PlayStyle | null; handedness?: Handedness | null }): string | null {
  const parts = [p.playStyle ? PLAY_STYLE_LABEL[p.playStyle] : null, p.handedness ? HAND_LABEL[p.handedness] : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
