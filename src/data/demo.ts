// In-memory implementation with seeded Boston players.
//
// Exists so the product can be walked end to end -- onboarding, discovery, request,
// accept, the guardian gate, the confirmed moment -- without a backend. Other players
// respond on a short delay so the loop actually closes. State persists locally so a
// reload doesn't restart onboarding.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, type HitsApi, type SendDoubles } from './api';
import type {
  Approval, Assurance, Coaching, DoublesMember, DoublesRole, DoublesSuggestion, PlayFormat, Tournament, TournamentEntry, TournamentPlayer, CoachPairing, CoachStatus, Court, CourtStats, GuardianCoachLink, HitPlan, Roster, DeclineReason,
  DiscoverFilters, GuardianChild, HitRequest, HitState, InboxEntry, Invite, MarketStatus, Message, MyCoach, Pairing, Player,
  Profile, ProfileInput, RosterMember, Session, UtrClaim,
} from './types';
import { DECLINE_COPY } from './types';
import { notifyLocal } from '@/lib/push';
import { midpointCourt } from '@/lib/courts';

const KEY = 'hits.demo.v4';
const ME = 'me';
const GUARDIAN = 'guardian-me';

type SeedPlayer = {
  id: string; age?: number; name: string; initial: string; band: 'minor' | 'adult'; level: number;
  miles: number; activeHoursAgo: number; response: number | null; accept: number | null;
  looking: boolean; court: string; avail: number; hits: number; verified?: boolean; prefers?: string;
  fmt?: PlayFormat;
};

const COURTS: Court[] = [
  { id: 'c-rinconada', name: 'Rinconada Park', access: 'public', indoor: false, surface: 'hard', distanceBucket: 'under 1 mi', address: 'Rinconada Park, Palo Alto, CA' },
  { id: 'c-mitchell', name: 'Mitchell Park', access: 'public', indoor: false, surface: 'hard', distanceBucket: '~2 mi', address: 'Mitchell Park, Palo Alto, CA' },
  { id: 'c-cubberley', name: 'Cubberley Courts', access: 'public', indoor: false, surface: 'hard', distanceBucket: '~3 mi', address: 'Cubberley Community Center, Palo Alto, CA' },
  { id: 'c-burgess', name: 'Burgess Park', access: 'public', indoor: false, surface: 'hard', distanceBucket: '~3 mi', address: 'Burgess Park, Menlo Park, CA' },
  { id: 'c-nealon', name: 'Nealon Park', access: 'public', indoor: false, surface: 'hard', distanceBucket: '~4 mi', address: 'Nealon Park, Menlo Park, CA' },
  { id: 'c-stanford', name: 'Stanford Taube Courts', access: 'club', indoor: false, surface: 'hard', distanceBucket: '~2 mi', address: 'Taube Family Tennis Center, Stanford, CA' },
  { id: 'c-cuesta', name: 'Cuesta Park', access: 'public', indoor: false, surface: 'hard', distanceBucket: '~6 mi', address: 'Cuesta Park, Mountain View, CA' },
  { id: 'c-sunnyvale', name: 'Sunnyvale Tennis Center', access: 'club', indoor: false, surface: 'hard', distanceBucket: '~9 mi', address: 'Sunnyvale Tennis Center, Sunnyvale, CA' },
  { id: 'c-losaltos', name: 'Los Altos Hills Courts', access: 'public', indoor: false, surface: 'hard', distanceBucket: '~7 mi', address: 'Los Altos Hills, CA' },
];

const SEED: SeedPlayer[] = [
  { id: 'p-maya', age: 15, name: 'Maya', initial: 'R', band: 'minor', level: 8.6, miles: 2.1, activeHoursAgo: 0.5, response: 0.94, accept: 0.7, looking: true, court: 'c-stanford', avail: 8 | 16 | 4, hits: 14, prefers: 'Practice sets' },
  { id: 'p-theo', age: 16, name: 'Theo', initial: 'K', band: 'minor', level: 8.9, miles: 3.8, activeHoursAgo: 5, response: 0.8, accept: 0.6, looking: true, court: 'c-mitchell', avail: 8 | 4, hits: 9 },
  { id: 'p-priya', age: 14, name: 'Priya', initial: 'S', band: 'minor', level: 8.1, miles: 1.4, activeHoursAgo: 20, response: 1.0, accept: 0.9, looking: false, court: 'c-rinconada', avail: 8 | 16 | 32, hits: 22, verified: true },
  { id: 'p-jonah', age: 17, name: 'Jonah', initial: 'L', band: 'minor', level: 9.4, miles: 6.2, activeHoursAgo: 30, response: 0.55, accept: 0.4, looking: false, court: 'c-cuesta', avail: 4 | 32, hits: 5 },
  { id: 'p-elena', age: 13, name: 'Elena', initial: 'M', band: 'minor', level: 7.9, miles: 4.9, activeHoursAgo: 2, response: 0.88, accept: 0.8, looking: true, court: 'c-burgess', avail: 1 | 8 | 16, hits: 11 },
  { id: 'p-sam', age: 12, name: 'Sam', initial: 'D', band: 'minor', level: 8.3, miles: 8.7, activeHoursAgo: 70, response: null, accept: null, looking: false, court: 'c-sunnyvale', avail: 8, hits: 0 },
  { id: 'p-lucas', age: 17, name: 'Lucas', initial: 'P', band: 'minor', level: 9.8, miles: 5.5, activeHoursAgo: 12, response: 0.7, accept: 0.5, looking: true, court: 'c-losaltos', avail: 2 | 4 | 16, hits: 17 },
  { id: 'p-ava', age: 13, name: 'Ava', initial: 'C', band: 'minor', level: 7.2, miles: 3.1, activeHoursAgo: 48, response: 0.6, accept: 0.7, looking: false, court: 'c-nealon', avail: 8 | 16, hits: 3 },
  { id: 'p-nico', age: 16, name: 'Nico', initial: 'B', band: 'minor', level: 8.5, miles: 11.3, activeHoursAgo: 1, response: 0.9, accept: 0.85, looking: true, court: 'c-cuesta', avail: 4 | 8 | 32, hits: 8 },
  { id: 'p-ruby', age: 15, name: 'Ruby', initial: 'A', band: 'minor', level: 8.4, miles: 0.9, activeHoursAgo: 0.3, response: 0.96, accept: 0.8, looking: true, court: 'c-rinconada', avail: 8 | 16 | 32, hits: 18, verified: true, prefers: 'Drills, then sets' },
  { id: 'p-dev', age: 16, name: 'Dev', initial: 'N', band: 'minor', level: 8.7, miles: 1.8, activeHoursAgo: 1.5, response: 0.82, accept: 0.65, looking: true, court: 'c-mitchell', avail: 4 | 8, hits: 12 },
  { id: 'p-clara', age: 13, name: 'Clara', initial: 'V', band: 'minor', level: 7.6, miles: 2.4, activeHoursAgo: 4, response: 0.9, accept: 0.85, looking: true, court: 'c-burgess', avail: 1 | 8 | 16, hits: 7 },
  { id: 'p-mateo', age: 17, name: 'Mateo', initial: 'R', band: 'minor', level: 9.1, miles: 3.2, activeHoursAgo: 8, response: 0.74, accept: 0.55, looking: true, court: 'c-stanford', avail: 2 | 4 | 32, hits: 21, verified: true },
  { id: 'p-zoe', age: 14, name: 'Zoe', initial: 'H', band: 'minor', level: 8.2, miles: 1.1, activeHoursAgo: 0.8, response: 1.0, accept: 0.9, looking: true, court: 'c-rinconada', avail: 8 | 16, hits: 16 },
  { id: 'p-arjun', age: 16, name: 'Arjun', initial: 'P', band: 'minor', level: 8.8, miles: 4.4, activeHoursAgo: 18, response: 0.68, accept: 0.6, looking: false, court: 'c-cuesta', avail: 4 | 8 | 16, hits: 10 },
  { id: 'p-iris', age: 12, name: 'Iris', initial: 'L', band: 'minor', level: 7.4, miles: 2.9, activeHoursAgo: 3, response: 0.87, accept: 0.78, looking: true, court: 'c-nealon', avail: 1 | 16 | 32, hits: 6 },
  { id: 'p-felix', age: 17, name: 'Felix', initial: 'B', band: 'minor', level: 9.3, miles: 5.8, activeHoursAgo: 22, response: 0.6, accept: 0.45, looking: false, court: 'c-losaltos', avail: 4 | 32, hits: 24 },
  { id: 'p-nina', age: 15, name: 'Nina', initial: 'K', band: 'minor', level: 8.0, miles: 1.6, activeHoursAgo: 2.5, response: 0.93, accept: 0.82, looking: true, court: 'c-mitchell', avail: 8 | 16 | 32, hits: 13, verified: true },
  { id: 'p-owen', age: 14, name: 'Owen', initial: 'S', band: 'minor', level: 8.6, miles: 6.7, activeHoursAgo: 40, response: 0.5, accept: 0.5, looking: false, court: 'c-sunnyvale', avail: 4 | 8, hits: 4 },
  { id: 'p-leila', age: 13, name: 'Leila', initial: 'M', band: 'minor', level: 7.8, miles: 3.6, activeHoursAgo: 6, response: 0.85, accept: 0.75, looking: true, court: 'c-burgess', avail: 8 | 16, hits: 9 },
  { id: 'p-hugo', age: 17, name: 'Hugo', initial: 'T', band: 'minor', level: 9.7, miles: 8.2, activeHoursAgo: 14, response: 0.72, accept: 0.4, looking: true, court: 'c-losaltos', avail: 2 | 4, hits: 29, verified: true },
  { id: 'p-tess', age: 15, name: 'Tess', initial: 'D', band: 'minor', level: 8.5, miles: 0.6, activeHoursAgo: 0.2, response: 0.98, accept: 0.88, looking: true, court: 'c-rinconada', avail: 1 | 8 | 16 | 32, hits: 20, prefers: 'Rally & drills' },
  { id: 'p-caleb', age: 12, name: 'Caleb', initial: 'J', band: 'minor', level: 7.1, miles: 4.1, activeHoursAgo: 52, response: 0.55, accept: 0.65, looking: false, court: 'c-nealon', avail: 16, hits: 2 },
  { id: 'p-anya', age: 16, name: 'Anya', initial: 'F', band: 'minor', level: 9.0, miles: 2.2, activeHoursAgo: 9, response: 0.8, accept: 0.6, looking: true, court: 'c-stanford', avail: 4 | 8 | 16, hits: 15 },
  { id: 'p-rafi', age: 14, name: 'Rafi', initial: 'C', band: 'minor', level: 8.3, miles: 7.9, activeHoursAgo: 28, response: 0.62, accept: 0.55, looking: false, court: 'c-sunnyvale', avail: 8 | 32, hits: 8 },
  { id: 'p-juno', age: 17, name: 'Juno', initial: 'W', band: 'minor', level: 10.2, miles: 5.1, activeHoursAgo: 1.2, response: 0.91, accept: 0.35, looking: true, court: 'c-stanford', avail: 2 | 4 | 32, hits: 33, verified: true, prefers: 'Match play' },

  { id: 'p-dan', name: 'Dan', initial: 'W', band: 'adult', level: 8.7, miles: 2.8, activeHoursAgo: 3, response: 0.9, accept: 0.7, looking: true, court: 'c-stanford', avail: 4 | 8, hits: 31, verified: true, prefers: 'Sets' },
  { id: 'p-marisol', name: 'Marisol', initial: 'G', band: 'adult', level: 8.2, miles: 5.1, activeHoursAgo: 26, response: 0.75, accept: 0.6, looking: false, court: 'c-cuesta', avail: 1 | 8 | 16, hits: 12 },
  { id: 'p-elena-r', name: 'Elena', initial: 'R', band: 'adult', level: 10.3, miles: 1.2, activeHoursAgo: 1.5, response: 0.9, accept: 0.75, looking: true, court: 'c-rinconada', avail: 4 | 32, hits: 27, prefers: 'Practice sets' },
  { id: 'p-kenji', name: 'Kenji', initial: 'O', band: 'adult', level: 9.6, miles: 3.3, activeHoursAgo: 0.2, response: 0.97, accept: 0.8, looking: true, court: 'c-rinconada', avail: 4 | 32, hits: 40, prefers: 'Rally & drills' },
  { id: 'p-rachel', name: 'Rachel', initial: 'F', band: 'adult', level: 7.8, miles: 7.4, activeHoursAgo: 9, response: 0.65, accept: 0.5, looking: true, court: 'c-burgess', avail: 8 | 16, hits: 6 },
  { id: 'p-omar', name: 'Omar', initial: 'H', band: 'adult', level: 8.9, miles: 12.6, activeHoursAgo: 100, response: 0.4, accept: 0.3, looking: false, court: 'c-sunnyvale', avail: 4, hits: 2 },
  { id: 'p-grace', name: 'Grace', initial: 'T', band: 'adult', level: 8.4, miles: 1.9, activeHoursAgo: 15, response: 0.85, accept: 0.75, looking: true, court: 'c-rinconada', avail: 1 | 2 | 8, hits: 19 },
  { id: 'p-priya-a', name: 'Anika', initial: 'R', band: 'adult', level: 8.5, miles: 1.3, activeHoursAgo: 1, response: 0.92, accept: 0.8, looking: true, court: 'c-rinconada', avail: 1 | 8 | 16, hits: 26 },
  { id: 'p-tom', name: 'Tom', initial: 'E', band: 'adult', level: 9.1, miles: 4.2, activeHoursAgo: 6, response: 0.78, accept: 0.6, looking: true, court: 'c-mitchell', avail: 4 | 8, hits: 22, verified: true },
  { id: 'p-nadia', name: 'Nadia', initial: 'K', band: 'adult', level: 7.9, miles: 2.6, activeHoursAgo: 12, response: 0.83, accept: 0.7, looking: true, court: 'c-burgess', avail: 8 | 16 | 32, hits: 14 },
  { id: 'p-phil', name: 'Phil', initial: 'M', band: 'adult', level: 8.3, miles: 6.1, activeHoursAgo: 30, response: 0.58, accept: 0.5, looking: false, court: 'c-cuesta', avail: 4 | 32, hits: 9 },
  { id: 'p-sofia', name: 'Sofia', initial: 'L', band: 'adult', level: 8.8, miles: 3.7, activeHoursAgo: 2, response: 0.95, accept: 0.75, looking: true, court: 'c-stanford', avail: 1 | 4 | 8, hits: 35, verified: true },
  { id: 'p-hassan', name: 'Hassan', initial: 'A', band: 'adult', level: 9.4, miles: 8.8, activeHoursAgo: 20, response: 0.66, accept: 0.45, looking: false, court: 'c-losaltos', avail: 2 | 4, hits: 18 },
  { id: 'p-jen', name: 'Jen', initial: 'C', band: 'adult', level: 7.5, miles: 1.7, activeHoursAgo: 4, response: 0.89, accept: 0.85, looking: true, court: 'c-nealon', avail: 8 | 16, hits: 11 },
  { id: 'p-victor', name: 'Victor', initial: 'B', band: 'adult', level: 10.0, miles: 5.4, activeHoursAgo: 0.6, response: 0.93, accept: 0.3, looking: true, court: 'c-stanford', avail: 4 | 32, hits: 48, verified: true },
  { id: 'p-mei', name: 'Mei', initial: 'Z', band: 'adult', level: 8.1, miles: 9.6, activeHoursAgo: 60, response: 0.45, accept: 0.6, looking: false, court: 'c-sunnyvale', avail: 8, hits: 5 },
  { id: 'p-gabe', name: 'Gabe', initial: 'N', band: 'adult', level: 8.6, miles: 2.3, activeHoursAgo: 7, response: 0.86, accept: 0.72, looking: true, court: 'c-rinconada', avail: 1 | 8 | 32, hits: 23 },
];

// What each seeded player is after, when the seed line does not say: a steady mix, so the
// doubles list is never empty and never everyone.
const FORMATS: PlayFormat[] = ['either', 'doubles', 'singles'];
function fmtOf(p: SeedPlayer): PlayFormat { return p.fmt ?? FORMATS[SEED.indexOf(p) % 3]; }

// Tournaments in the demo: made up, local-sounding, and dated from today so they never go
// stale. Not real events; on Hits, players add the tournaments they are playing.
type DemoTournament = { id: string; name: string; startIn: number; days: number; location: string; band: 'minor' | 'adult' };
const TOURNAMENTS: DemoTournament[] = [
  { id: 't-pjo', name: 'Peninsula Junior Open', startIn: 0, days: 2, location: 'Mitchell Park, Palo Alto', band: 'minor' },
  { id: 't-bjd', name: 'Bayside Junior Doubles Day', startIn: 14, days: 1, location: 'Cuesta Park, Mountain View', band: 'minor' },
  { id: 't-mdc', name: 'Midpeninsula Doubles Classic', startIn: 7, days: 2, location: 'Burgess Park, Menlo Park', band: 'adult' },
];
// The next Saturday on or after today, plus whole days.
function satPlus(days: number): string {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7) + days);
  return localDate(d);
}
function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function divisionFor(p: SeedPlayer): string {
  if (p.band === 'adult') return p.level >= 9.5 ? 'Open' : '4.0';
  const a = p.age ?? 16;
  return a <= 12 ? '12U' : a <= 14 ? '14U' : a <= 16 ? '16U' : '18U';
}
// Who the seeded players say they are playing. Roughly half of each side, with every
// third doubles player still looking for a partner.
function seedEntries(t: DemoTournament): Record<string, TournamentEntry> {
  const out: Record<string, TournamentEntry> = {};
  SEED.filter(p => p.band === t.band).forEach((p, i) => {
    if ((i + t.id.length) % 2) return;
    const doubles = fmtOf(p) !== 'singles' || t.id === 't-bjd' || t.id === 't-mdc';
    out[p.id] = { division: divisionFor(p), singles: fmtOf(p) !== 'doubles' && t.id === 't-pjo', doubles, wantsPartner: doubles && i % 3 === 0 };
  });
  return out;
}

type Row = {
  id: string; fromId: string; toId: string; courtId: string; windowStart: string; windowEnd: string;
  note: string | null; state: HitState; awaitingId: string | null; expiresAt: string; createdAt: string;
  confirmedAt: string | null; declineReason: string | null;
  approvals: Approval[]; confirmations: Record<string, boolean>; plan: HitPlan; shares?: string[];
  format?: 'singles' | 'doubles'; matchId?: string | null; doublesRole?: DoublesRole | null; tournamentId?: string | null;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const iso = (d: Date) => d.toISOString();
const hoursAgo = (h: number) => iso(new Date(Date.now() - h * 3600000));

const emptyPlan = (): HitPlan => ({ ballsById: null, format: null, meetAt: null, lateById: null });

// Roster codes are handed out by a coach or captain. Known demo codes:
const DEMO_ROSTERS: Roster[] = [
  { id: 'r-paly', name: 'Paly Girls Varsity', code: 'PALY26', cap: 20, joined: 11, createdAt: hoursAgo(300) },
  { id: 'r-menlo', name: 'Menlo Boys Varsity', code: 'MENLO26', cap: 20, joined: 7, createdAt: hoursAgo(200) },
];

// A personal invite already out in the world, so the code field can be walked through
// both ways. Real ones are eight characters of entropy; this one is typeable.
const DEMO_INVITES: { code: string; from: string }[] = [{ code: 'MAYA7QK2', from: 'Maya' }];

type State = {
  session: Session | null;
  profile: null | {
    displayName: string; lastInitial: string; dateOfBirth: string; levelValue: number;
    levelSource: Profile['levelSource']; homeCourtId: string; availabilityMask: number;
    lookingToHitUntil: string | null; lastActiveAt: string;
    guardianEmail: string | null; guardianPhone?: string | null; guardianVerified: boolean;
    guardianSentAt: string | null; guardianOpenedAt: string | null; rosterName: string | null; photo?: string | null; photoPending?: string | null; prefers?: string | null;
    maxPartnerAgeGap?: number | null;
    playFormat?: PlayFormat;
  };
  // Tournaments players added in this demo, and your entries (and your sister's), by id.
  addedTournaments?: { id: string; name: string; startsOn: string; endsOn: string; location: string | null; url: string | null }[];
  entries?: Record<string, Record<string, TournamentEntry>>;
  // When you last opened each thread, by hit id. Unread is anything newer from them.
  reads?: Record<string, string>;
  // The demo parent's other child: her rule, set from the family view.
  siblingGap?: number | null;
  siblingRevoked?: boolean;
  // You as a coach: your academy, and when Hits finishes verifying you for juniors.
  coaching?: { academy: string; code: string; verifyAt: string } | null;
  coachPairs?: (Omit<CoachPairing, 'aName' | 'bName'>)[];
  // You as a player, linked to the demo's coach.
  myCoach?: { status: CoachStatus; joinedAt: string; paired?: boolean } | null;
  pairings?: { id: string; otherId: string; courtId: string | null; windowStart: string | null; windowEnd: string | null; note: string | null; state: 'open' | 'sent' | 'dismissed'; createdAt: string }[];
  rosters: Roster[];
  invites: Invite[];
  pushToken: string | null;
  reports: { profileId: string; reason: string; body: string; hitId: string | null; at: string }[];
  utrClaim: UtrClaim | null;
  requests: Row[];
  messages: Message[];
  blocked: string[];
  cohortOpen: boolean;
  listMode: boolean | null;
  seenConfirmed: string[];
};

const blank = (): State => ({
  session: null, profile: null, requests: [], messages: [], blocked: [],
  cohortOpen: true, listMode: null, seenConfirmed: [], rosters: [], invites: [], pushToken: null, reports: [], utrClaim: null,
});

// Bay Area sprawl: mile steps to 15, then fives. People here drive 280.
function bucket(mi: number): string {
  if (mi < 1) return 'under 1 mi';
  if (mi < 15) return `~${Math.round(mi)} mi`;
  return `~${Math.round(mi / 5) * 5} mi`;
}

function ageOf(dob: string): number {
  // Local noon, not UTC midnight: west of Greenwich the latter is the day before.
  const d = new Date(`${dob.slice(0, 10)}T12:00:00`), now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a -= 1;
  return a;
}

// The demo parent has two kids: whoever is playing the demo, and a younger sister with a
// week of her own, so the family view shows what it is for.
const SIBLING = { id: 'kid-lily', name: 'Lily', initial: 'T', age: 12, level: 5.8, court: 'c-mitchell', avail: 8 | 16 };

// The demo's coach, for walking the player side: join with code PTA26.
const COACH = { id: 'coach-maria', name: 'Maria S.', academy: 'Peninsula Tennis Academy', code: 'PTA26' };
// Who is on your roster when you turn on coach tools in the demo: adults, and juniors who
// wait on Hits verifying you. Clara's parent has not answered yet, so she stays waiting.
const ROSTER = ['p-kenji', 'p-elena-r', 'p-grace', 'p-gabe', 'p-priya-a', 'p-tom', 'p-sofia', 'p-dan',
  'p-maya', 'p-theo', 'p-ruby', 'p-zoe', 'p-dev', 'p-tess', 'p-nina', 'p-clara'];
const WAITING_ON_PARENT = new Set(['p-clara']);

function bandOf(dob: string): 'minor' | 'adult' {
  const d = new Date(dob);
  const eighteen = new Date(d.getFullYear() + 18, d.getMonth(), d.getDate());
  return eighteen <= new Date() ? 'adult' : 'minor';
}


export class DemoApi implements HitsApi {
  readonly mode = 'demo' as const;
  private s: State = blank();
  private loading: Promise<void> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];

  // ---- plumbing ----------------------------------------------------------------
  // A cold start from a deep link calls this three times in the same tick. The promise
  // is the lock: a flag set after an await is no lock at all, and the losers used to
  // each overwrite the state and start their own forever-interval.
  private load() {
    if (!this.loading) this.loading = this.read();
    return this.loading;
  }

  private async read() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) this.s = { ...blank(), ...JSON.parse(raw) };
    } catch { /* fresh state */ }
    // Simulated replies are timers; a reload would drop them. Settle anything that has
    // been waiting long enough, and keep settling in the background.
    this.reconcile();
    if (!this.heartbeat) this.heartbeat = setInterval(() => { if (this.reconcile()) this.save(); }, 3000);
  }

  private reconcile(): boolean {
    const now = Date.now();
    const age = (iso: string) => now - new Date(iso).getTime();
    let changed = false;
    if (this.s.profile?.guardianEmail && !this.s.profile.guardianVerified && this.s.profile.guardianSentAt) {
      const a = age(this.s.profile.guardianSentAt);
      if (a > 4000 && !this.s.profile.guardianOpenedAt) { this.s.profile.guardianOpenedAt = iso(new Date()); changed = true; }
      if (a > 8000) { this.s.profile.guardianVerified = true; changed = true; }
    }
    for (const r of this.s.requests) {
      const seedIsRecipient = r.toId !== ME;
      if ((r.state === 'pending' || r.state === 'countered') && r.awaitingId !== ME && age(r.createdAt) > 8000) {
        const seed = SEED.find(p => p.id === (seedIsRecipient ? r.toId : r.fromId));
        if (seed && (seed.accept ?? 0.7) < 0.5 && r.id.charCodeAt(0) % 3 === 0) { r.state = 'declined'; r.declineReason = DECLINE_COPY.not_this_week; r.awaitingId = null; }
        else this.onAccepted(r, true);
        changed = true;
      }
      if (r.state === 'accepted') {
        for (const a of r.approvals) {
          if (a.minorId !== ME && a.decision == null && age(a.createdAt ?? r.createdAt) > 12000) { a.decision = true; a.decidedAt = iso(new Date()); changed = true; }
        }
        const before = r.state; this.maybeConfirm(r); if (r.state !== before) changed = true;
      }
    }
    // Coaching, settled the same way so a reload does not strand anything halfway.
    const mc = this.s.myCoach;
    if (mc && mc.status === 'parent' && age(mc.joinedAt) > 10000) { mc.status = 'active'; mc.joinedAt = iso(new Date()); changed = true; }
    if (mc && mc.status === 'active' && !mc.paired && age(mc.joinedAt) > 5000) { mc.paired = true; this.coachSuggests(); changed = true; }
    for (const x of this.s.coachPairs ?? []) {
      if (x.state === 'open' && age(x.createdAt) > 6000) { x.state = 'sent'; x.hitState = 'pending'; changed = true; }
      if (x.state === 'sent' && x.hitState === 'pending' && age(x.createdAt) > 12000) { x.hitState = 'confirmed'; changed = true; }
    }
    return changed;
  }
  private save() {
    void AsyncStorage.setItem(KEY, JSON.stringify(this.s)).catch(() => {});
    this.listeners.forEach(l => l());
  }
  private later(ms: number, fn: () => void) {
    const t = setTimeout(() => { fn(); this.save(); }, ms);
    this.timers.push(t);
  }
  private wait(ms = 120) { return new Promise(r => setTimeout(r, ms)); }
  onChange(cb: () => void) { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }

  // demo-only controls, surfaced from the You tab
  get cohortOpen() { return this.s.cohortOpen; }
  setCohortOpen(v: boolean) { this.s.cohortOpen = v; this.save(); }
  get listMode() { return this.s.listMode; }
  setListMode(v: boolean) { this.s.listMode = v; this.save(); }
  hasSeenConfirmed(id: string) { return this.s.seenConfirmed.includes(id); }
  markSeenConfirmed(id: string) { if (!this.hasSeenConfirmed(id)) { this.s.seenConfirmed.push(id); this.save(); } }
  switchToGuardian() {
    if (!this.s.session) return;
    this.s.session = { ...this.s.session, userId: GUARDIAN, isGuardian: true };
    this.save();
  }
  switchToPlayer() {
    if (!this.s.session) return;
    this.s.session = { ...this.s.session, userId: ME, isGuardian: false };
    this.save();
  }
  async reset() {
    this.timers.forEach(clearTimeout); this.timers = [];
    if (this.heartbeat) { clearInterval(this.heartbeat); this.heartbeat = null; }
    this.s = blank(); this.loading = null;
    await AsyncStorage.removeItem(KEY); this.listeners.forEach(l => l());
  }

  // ---- auth --------------------------------------------------------------------
  async restore() { await this.load(); return this.s.session; }
  async sendCode(phone: string) { await this.load(); if (phone.replace(/\D/g, '').length < 10) throw new ApiError('That number looks short.'); await this.wait(300); }
  async verifyCode(phone: string, code: string) {
    await this.load(); await this.wait(400);
    if (code !== '000000') throw new ApiError("That's not it. Demo code is 000000.");
    this.s.session = { userId: ME, phone, isGuardian: false };
    this.save();
    return this.s.session;
  }
  async signOut() { this.s.session = null; this.save(); }
  // In the demo there is nothing on a server to delete, so this is the reset -- which is
  // also the honest answer: everything the demo knows about you was only ever local.
  async deleteAccount() { await this.reset(); }

  // ---- me ----------------------------------------------------------------------
  private myBand(): 'minor' | 'adult' { return this.s.profile ? bandOf(this.s.profile.dateOfBirth) : 'minor'; }

  private meProfile(): Profile | null {
    const p = this.s.profile; if (!p) return null;
    const mine = this.s.requests.filter(r => r.toId === ME);
    const responded = mine.filter(r => r.state !== 'pending' && r.state !== 'expired');
    const accepted = responded.filter(r => ['accepted', 'confirmed', 'completed'].includes(r.state));
    return {
      id: ME, displayName: p.displayName, lastInitial: p.lastInitial, photoUrl: p.photo ?? null,
      band: bandOf(p.dateOfBirth), levelValue: p.levelValue, levelSource: p.levelSource,
      homeCourtId: p.homeCourtId, availabilityMask: p.availabilityMask,
      lastActiveAt: p.lastActiveAt, lookingToHitUntil: p.lookingToHitUntil,
      responseRate: mine.length ? responded.length / mine.length : null,
      acceptRate: responded.length ? accepted.length / responded.length : null,
      hitsConfirmed: this.s.requests.filter(r => r.state === 'completed').length,
      prefers: p.prefers ?? null,
      age: bandOf(p.dateOfBirth) === 'minor' ? ageOf(p.dateOfBirth) : null,
      maxPartnerAgeGap: p.maxPartnerAgeGap ?? null,
      playFormat: p.playFormat ?? 'either',
      phoneVerified: true,
      guardianVerified: p.guardianVerified,
      guardianPending: !!p.guardianEmail && !p.guardianVerified,
      guardianSentAt: p.guardianSentAt, guardianOpenedAt: p.guardianOpenedAt, rosterName: p.rosterName, photoPendingUrl: p.photoPending ?? null,
    };
  }
  async me() { await this.load(); return this.meProfile(); }

  async createProfile(input: ProfileInput) {
    await this.load(); await this.wait();
    const code = input.joinCode?.trim().toLowerCase() ?? null;
    const roster = code ? [...DEMO_ROSTERS, ...this.s.rosters].find(r => r.code.toLowerCase() === code) : null;
    if (roster) roster.joined += 1;
    this.s.profile = {
      ...input, lookingToHitUntil: iso(new Date(Date.now() + 7 * 86400000)),
      lastActiveAt: iso(new Date()), guardianEmail: null, guardianVerified: false,
      guardianSentAt: null, guardianOpenedAt: null, rosterName: roster?.name ?? null,
    };
    // Someone reaches out shortly after you join, so the Requests tab is alive.
    const band = bandOf(input.dateOfBirth);
    const first = SEED.find(x => x.band === band && x.looking)!;
    this.later(6000, () => {
      if (this.s.requests.some(r => r.fromId === first.id)) return;
      const start = nextSlot(first.avail & input.availabilityMask || first.avail, 1);
      const r0 = row(first.id, ME, first.court, start, 'Saw you just joined. Up for a hit?', ME);
      this.s.requests.push(r0);
      // Said the way the server says it: the real day and time, not a guess.
      const when = start.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: start.getMinutes() ? '2-digit' : undefined });
      void notifyLocal(`${first.name} wants to hit`, `${when} · ${COURTS.find(c => c.id === first.court)?.name ?? 'the courts'}`, { hit: r0.id });
    });
    this.save();
    return this.meProfile()!;
  }
  async updateProfile(patch: Partial<Profile>) {
    await this.load(); if (!this.s.profile) throw new ApiError('no profile');
    Object.assign(this.s.profile, patch);
    this.save(); return this.meProfile()!;
  }
  async setLooking(days: number | null) {
    await this.load(); if (!this.s.profile) throw new ApiError('no profile');
    this.s.profile.lookingToHitUntil = days ? iso(new Date(Date.now() + days * 86400000)) : null;
    this.save(); return this.meProfile()!;
  }
  async setLocation() { /* demo: always Wellesley */ }
  async touch() { await this.load(); if (this.s.profile) { this.s.profile.lastActiveAt = iso(new Date()); } }

  // ---- market ------------------------------------------------------------------
  async marketStatus(): Promise<MarketStatus> {
    await this.load();
    const band = this.myBand();
    return {
      marketSlug: 'palo-alto', marketName: 'Palo Alto', band,
      activePlayers: this.s.cohortOpen ? (band === 'minor' ? 176 : 163) : 112,
      minActivePlayers: 150,
      discoveryOpen: this.s.cohortOpen,
    };
  }
  async courts() { await this.load(); return COURTS; }
  async courtPlayers(): Promise<CourtStats[]> {
    await this.load();
    const band = this.myBand();
    const visible = SEED.filter(p => p.band === band && !this.s.blocked.includes(p.id) && p.activeHoursAgo < 24 * 30 && this.ageOk(p, null));
    return COURTS.map(c => ({ courtId: c.id, players: visible.filter(p => p.court === c.id).length, looking: visible.filter(p => p.court === c.id && p.looking).length }));
  }
  async peek(level: number, dateOfBirth: string) {
    await this.wait(250);
    const band = bandOf(dateOfBirth);
    const pool = SEED.filter(p => p.band === band && Math.abs(p.level - level) <= 1.0);
    const sample = pool.sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level)).slice(0, 3).map(p => this.toPlayer(p, level));
    return { count: pool.length + 9, sample };
  }

  // ---- discovery ---------------------------------------------------------------
  private toPlayer(p: SeedPlayer, myLevel: number | null): Player {
    return {
      id: p.id, displayName: p.name, lastInitial: p.initial, photoUrl: null,
      levelValue: p.level, levelSource: p.verified ? 'utr_verified' : 'utr_self', levelVerified: !!p.verified,
      levelDelta: myLevel == null ? null : Math.abs(p.level - myLevel),
      distanceBucket: bucket(p.miles), homeCourtId: p.court,
      homeCourtName: COURTS.find(c => c.id === p.court)?.name ?? null,
      availabilityMask: p.avail, lookingToHit: p.looking, lastActiveAt: hoursAgo(p.activeHoursAgo),
      responseRate: p.response, acceptRate: p.accept, hitsConfirmed: p.hits, prefers: p.prefers ?? null,
      age: p.band === 'minor' && this.myBand() === 'minor' ? p.age ?? null : null,
      playFormat: fmtOf(p),
    };
  }
  // The age rule as the database applies it: the parent's limit always, the junior's own
  // "around my age" when they ask for it. Adults are never limited by age.
  private ageOk(p: SeedPlayer, ownGap: number | null) {
    const me = this.s.profile; if (!me || bandOf(me.dateOfBirth) === 'adult' || p.band === 'adult' || p.age == null) return true;
    const diff = Math.abs(p.age - ageOf(me.dateOfBirth));
    const rule = me.maxPartnerAgeGap ?? null;
    return (rule == null || diff <= rule) && (ownGap == null || diff <= ownGap);
  }
  async discover(f: DiscoverFilters) {
    await this.load(); await this.wait(180);
    const me = this.meProfile(); if (!me) return [];
    if (!this.s.cohortOpen) return [];
    const myLevel = me.levelValue ?? 8;
    return SEED
      .filter(p => p.band === me.band)
      .filter(p => !this.s.blocked.includes(p.id))
      .filter(p => p.miles <= f.radiusMi)
      .filter(p => f.levelLo == null || p.level >= f.levelLo)
      .filter(p => f.levelHi == null || p.level <= f.levelHi)
      .filter(p => !f.availability || (p.avail & f.availability))
      .filter(p => !f.onlyLooking || p.looking)
      .filter(p => this.ageOk(p, f.ageGap ?? null))
      .filter(p => p.activeHoursAgo < 24 * 30)
      .sort((a, b) => (Math.abs(a.level - myLevel) - Math.abs(b.level - myLevel)) || (a.miles - b.miles))
      .map(p => this.toPlayer(p, myLevel));
  }
  async player(id: string) {
    await this.load();
    const p = SEED.find(x => x.id === id); if (!p) return null;
    return this.toPlayer(p, this.meProfile()?.levelValue ?? null);
  }

  // ---- hits --------------------------------------------------------------------
  private toRequest(r: Row, viewer = ME): HitRequest {
    const otherId = r.fromId === viewer ? r.toId : r.fromId;
    const seed = SEED.find(p => p.id === otherId);
    const other = seed ? this.toPlayer(seed, this.meProfile()?.levelValue ?? null) : this.selfAsPlayer();
    return {
      id: r.id, fromId: r.fromId, toId: r.toId, courtId: r.courtId,
      courtName: COURTS.find(c => c.id === r.courtId)?.name ?? 'Court',
      windowStart: r.windowStart, windowEnd: r.windowEnd, note: r.note, state: r.state,
      awaitingId: r.awaitingId, expiresAt: r.expiresAt, createdAt: r.createdAt,
      confirmedAt: r.confirmedAt, declineReason: r.declineReason, other, approvals: r.approvals, plan: r.plan ?? emptyPlan(),
      myConfirmation: r.confirmations[viewer] ?? null,
      theirConfirmation: r.confirmations[otherId] ?? null,
      format: r.format ?? 'singles', matchId: r.matchId ?? null, doublesRole: r.doublesRole ?? null, tournamentId: r.tournamentId ?? null,
    };
  }
  private selfAsPlayer(): Player {
    const m = this.meProfile()!;
    return {
      id: ME, displayName: m.displayName, lastInitial: m.lastInitial, photoUrl: m.photoUrl,
      levelValue: m.levelValue, levelSource: m.levelSource, levelVerified: m.levelSource === 'utr_verified',
      levelDelta: 0, distanceBucket: null, homeCourtId: m.homeCourtId,
      homeCourtName: COURTS.find(c => c.id === m.homeCourtId)?.name ?? null,
      availabilityMask: m.availabilityMask, lookingToHit: !!m.lookingToHitUntil,
      lastActiveAt: m.lastActiveAt, responseRate: m.responseRate, acceptRate: m.acceptRate, hitsConfirmed: m.hitsConfirmed, prefers: m.prefers,
      age: m.age, playFormat: m.playFormat,
    };
  }
  private find(id: string) { const r = this.s.requests.find(x => x.id === id); if (!r) throw new ApiError('Not found'); return r; }

  async requests() { await this.load(); return this.s.requests.map(r => this.toRequest(r)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  async hit(id: string) {
    await this.load();
    const r = this.s.requests.find(x => x.id === id); if (!r) return null;
    return { request: this.toRequest(r), messages: this.s.messages.filter(m => m.hitId === id) };
  }

  // On accept: approvals are seeded for every minor participant; an adult-only hit
  // confirms immediately. Mirrors the database trigger exactly.
  private onAccepted(r: Row, settled = false) {
    r.state = 'accepted'; r.awaitingId = null;
    const minors: { id: string; name: string }[] = [];
    if (this.myBand() === 'minor') minors.push({ id: ME, name: this.s.profile!.displayName });
    const otherId = r.fromId === ME ? r.toId : r.fromId;
    const seed = SEED.find(p => p.id === otherId);
    if (seed?.band === 'minor') minors.push({ id: seed.id, name: seed.name });
    r.approvals = minors.map(m => ({ hitId: r.id, minorId: m.id, minorName: m.name, guardianUserId: m.id === ME ? GUARDIAN : `g-${m.id}`, decision: null, decidedAt: null, createdAt: iso(new Date()) }));
    if (r.approvals.length === 0) { r.state = 'confirmed'; r.confirmedAt = iso(new Date()); }
    else if (settled) { /* the background reconcile settles the other parent */ }
    else {
      // The other kid's parent says yes on their own time.
      r.approvals.filter(a => a.minorId !== ME).forEach(a => {
        this.later(4000, () => { a.seenAt = iso(new Date()); });
        this.later(9000 + Math.random() * 6000, () => {
          a.decision = true; a.decidedAt = iso(new Date());
          this.maybeConfirm(r);
        });
      });
    }
  }
  private maybeConfirm(r: Row) {
    if (r.state === 'accepted' && r.approvals.every(a => a.decision === true)) {
      r.state = 'confirmed'; r.confirmedAt = iso(new Date());
      const other = SEED.find(p => p.id === (r.fromId === ME ? r.toId : r.fromId));
      void notifyLocal("It's on.", `${other?.name ?? 'Your hit'} · ${COURTS.find(c => c.id === r.courtId)?.name ?? ''}`, { hit: r.id });
    }
  }

  async sendRequest(toId: string, courtId: string, start: Date, end: Date, note: string | null, doubles?: SendDoubles) {
    await this.load(); await this.wait();
    if (this.s.blocked.includes(toId)) throw new ApiError("You can't reach this player.");
    const seed = SEED.find(p => p.id === toId);
    if (!seed || seed.band !== this.myBand()) throw new ApiError("You can't reach this player.");
    if (!this.ageOk(seed, null)) throw new ApiError('Your parent has set an age range, and this player is outside it.');
    const r = row(ME, toId, courtId, start, note, toId, end);
    if (doubles) {
      // The same rules the database enforces on a doubles game.
      const game = doubles.matchId ? this.s.requests.filter(x => x.matchId === doubles.matchId) : [];
      if (doubles.matchId && !game.length) throw new ApiError('That doubles game is not on Hits.');
      if (game.some(x => x.fromId !== ME)) throw new ApiError('Only the player who set up the doubles game invites the others.');
      const live = game.filter(x => LIVE.includes(x.state));
      if (live.some(x => x.toId === toId)) throw new ApiError('They are already in this game.');
      if (doubles.role === 'partner' && live.some(x => x.doublesRole === 'partner')) throw new ApiError('This game already has a partner.');
      if (doubles.role === 'opponent' && live.filter(x => x.doublesRole === 'opponent').length >= 2) throw new ApiError('This game already has two opponents.');
      r.format = 'doubles'; r.matchId = doubles.matchId ?? r.id; r.doublesRole = doubles.role; r.tournamentId = doubles.tournamentId ?? null;
    }
    this.s.requests.push(r);
    // They reply. Mostly yes; sometimes a real, non-ghost "no".
    const declines = (seed.accept ?? 0.7) < 0.5 && Math.random() < 0.6;
    this.later(4000 + Math.random() * 4000, () => {
      if (r.state !== 'pending') return;
      if (declines) { r.state = 'declined'; r.declineReason = DECLINE_COPY.not_this_week; r.awaitingId = null; }
      else { this.onAccepted(r); const st: string = r.state; void notifyLocal(`${seed.name}'s in`, st === 'confirmed' ? "It's on." : 'Waiting on a parent to lock it in.', { hit: r.id }); }
    });
    this.save();
    return this.toRequest(r);
  }
  async updatePlan(id: string, patch: Partial<HitPlan>) {
    await this.load();
    const r = this.find(id); r.plan = { ...(r.plan ?? emptyPlan()), ...patch };
    this.save(); return this.toRequest(r);
  }
  async setPushToken(token: string) { await this.load(); this.s.pushToken = token; this.save(); }
  async beginUtrLink() { return null; }
  async utrStatus() { await this.load(); return null; }
  async unlinkUtr() { await this.load(); return (await this.me())!; }
  // In the demo the reviewer is fast and always says yes, so the whole path is walkable.
  async submitUtrClaim(rating: number, profileUrl: string, fullName: string, note?: string) {
    await this.load();
    if (!/^https?:\/\//i.test(profileUrl.trim())) throw new ApiError('We need the link to your UTR profile so we can check it.');
    if (fullName.trim().length < 2) throw new ApiError('We need the name on your UTR profile.');
    if (!(rating >= 1 && rating <= 16.5)) throw new ApiError('That is not a UTR.');
    this.s.utrClaim = {
      id: uid(), claimedRating: rating, profileUrl: profileUrl.trim(), fullName: fullName.trim(),
      state: 'pending', decidedRating: null, reviewerNote: null, decidedAt: null, createdAt: iso(new Date()),
    };
    if (this.s.profile) { this.s.profile.levelValue = rating; if (this.s.profile.levelSource !== 'utr_verified') this.s.profile.levelSource = 'utr_self'; }
    this.later(6000, () => {
      const c = this.s.utrClaim; if (!c || c.state !== 'pending') return;
      c.state = 'approved'; c.decidedRating = c.claimedRating; c.decidedAt = iso(new Date());
      if (this.s.profile) { this.s.profile.levelSource = 'utr_verified'; this.s.profile.levelValue = c.claimedRating; }
      void notifyLocal('Your UTR is verified', 'Your level now carries the badge.');
    });
    this.save();
  }
  async myUtrClaim() { await this.load(); return this.s.utrClaim ?? null; }
  async withdrawUtrClaim() { await this.load(); if (this.s.utrClaim?.state === 'pending') this.s.utrClaim = null; this.save(); }
  async setPhoto(base64: string | null) {
    await this.load(); if (!this.s.profile) throw new ApiError('no profile');
    const url = base64 ? `data:image/jpeg;base64,${base64}` : null;
    if (!url) { this.s.profile.photo = null; this.s.profile.photoPending = null; }
    else if (this.myBand() === 'minor') this.s.profile.photoPending = url;   // the parent approves it
    else this.s.profile.photo = url;
    this.save(); return this.meProfile()!;
  }
  async guardianRemovePhoto() { await this.load(); if (this.s.profile) { this.s.profile.photo = null; this.s.profile.photoPending = null; this.save(); } }
  async guardianApprovePhoto(_child: string, approve: boolean) {
    await this.load(); if (!this.s.profile) return;
    if (approve && this.s.profile.photoPending) this.s.profile.photo = this.s.profile.photoPending;
    this.s.profile.photoPending = null; this.save();
  }
  async sharePhone(id: string, share: boolean) {
    await this.load(); const r = this.find(id);
    if (share && !['confirmed', 'completed'].includes(r.state)) throw new ApiError('You can share your number once the hit is confirmed.');
    r.shares = (r.shares ?? []).filter(x => x !== ME); if (share) r.shares.push(ME);
    // The other player usually shares back a moment later.
    if (share) this.later(3000, () => { const rr = this.find(id); const other = rr.fromId === ME ? rr.toId : rr.fromId; if (!(rr.shares ?? []).includes(other)) rr.shares = [...(rr.shares ?? []), other]; });
    this.save();
  }
  async sharedPhones(id: string) {
    await this.load(); const r = this.find(id);
    if (!['confirmed', 'completed'].includes(r.state)) return [];
    const other = r.fromId === ME ? r.toId : r.fromId;
    // A non-seed counterparty gave findIndex -1 and a nine-digit number.
    const seat = Math.max(0, SEED.findIndex(p => p.id === other)) + 10;
    return (r.shares ?? []).map(pid => ({ profileId: pid, phone: pid === ME ? (this.s.session?.phone ?? '') : `+1 (650) 555-01${seat}`, mine: pid === ME }));
  }

  // ---- rosters -----------------------------------------------------------------
  async createRoster(name: string, cap: number): Promise<Roster> {
    await this.load();
    const code = name.replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase() + String(Math.floor(Math.random() * 90) + 10);
    const r: Roster = { id: uid(), name, code, cap, joined: 0, createdAt: iso(new Date()) };
    this.s.rosters.push(r); this.save(); return r;
  }
  async myRosters() { await this.load(); return this.s.rosters; }
  async checkCode(code: string) {
    await this.load(); await this.wait(200);
    const c = code.trim().toLowerCase();
    const r = [...DEMO_ROSTERS, ...this.s.rosters].find(x => x.code.toLowerCase() === c);
    if (r) return { valid: r.joined < r.cap, kind: 'roster' as const, label: r.name };
    const mine = this.s.invites.find(x => x.code.toLowerCase() === c);
    if (mine) return { valid: !mine.redeemed, kind: 'invite' as const, label: this.s.profile?.displayName ?? 'You' };
    const seeded = DEMO_INVITES.find(x => x.code.toLowerCase() === c);
    if (seeded) return { valid: true, kind: 'invite' as const, label: seeded.from };
    return { valid: false, kind: null, label: null };
  }

  async issueInvite(): Promise<Invite> {
    await this.load(); await this.wait();
    const open = this.s.invites.filter(i => !i.redeemed).length;
    if (open >= 10) throw new ApiError('You have ten invites out already. Wait for one to be used.');
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 8 }, () => A[Math.floor(Math.random() * A.length)]).join('');
    const inv: Invite = {
      code, redeemed: false,
      expiresAt: iso(new Date(Date.now() + 30 * 86400000)), createdAt: iso(new Date()),
    };
    this.s.invites.unshift(inv); this.save(); return inv;
  }

  async myInvites() { await this.load(); return this.s.invites; }
  async cancelRequest(id: string) { await this.load(); const r = this.find(id); r.state = 'cancelled'; r.awaitingId = null; this.save(); }
  async accept(id: string) {
    await this.load(); await this.wait();
    const r = this.find(id); if (r.awaitingId !== ME) throw new ApiError("It's not your move.");
    this.onAccepted(r); this.save(); return this.toRequest(r);
  }
  async decline(id: string, reason: DeclineReason) {
    await this.load(); await this.wait();
    const r = this.find(id); r.state = 'declined'; r.declineReason = DECLINE_COPY[reason]; r.awaitingId = null;
    this.save(); return this.toRequest(r);
  }
  async counter(id: string, courtId: string, start: Date, end: Date) {
    await this.load(); await this.wait();
    const r = this.find(id);
    // The same rules the database enforces: a past hit cannot move, and moving a hit is
    // always a new proposal the other player has to accept.
    if (new Date(r.windowEnd) < new Date()) throw new ApiError('This hit has already happened.');
    if (start < new Date()) throw new ApiError('Pick a time that has not passed.');
    r.courtId = courtId; r.windowStart = iso(start); r.windowEnd = iso(end);
    r.state = 'countered'; r.approvals = []; r.confirmedAt = null;
    r.expiresAt = iso(new Date(Math.min(start.getTime(), Date.now() + 72 * 3600000)));
    r.awaitingId = r.fromId === ME ? r.toId : r.fromId;
    this.later(3500 + Math.random() * 3000, () => { if (r.state === 'countered') this.onAccepted(r); });
    this.save(); return this.toRequest(r);
  }
  async sendMessage(id: string, body: string) {
    await this.load();
    const r = this.find(id);
    const m: Message = { id: uid(), hitId: id, senderId: ME, body, createdAt: iso(new Date()) };
    this.s.messages.push(m);
    const otherId = r.fromId === ME ? r.toId : r.fromId;
    const replies = ['Sounds good', 'See you there', 'Perfect', 'Works for me', 'Great, warm up then sets?', 'On my way when it gets closer'];
    this.later(2500 + Math.random() * 2500, () => {
      const body = replies[Math.floor(Math.random() * replies.length)];
      this.s.messages.push({ id: uid(), hitId: id, senderId: otherId, body, createdAt: iso(new Date()) });
      // The same push the server sends: who wrote, what they said, and it opens the thread.
      void notifyLocal(SEED.find(p => p.id === otherId)?.name ?? 'New message', body, { hit: id, chat: true });
    });
    this.save(); return m;
  }
  async inbox(): Promise<InboxEntry[]> {
    await this.load();
    const reads = this.s.reads ?? {};
    return this.s.requests.map(r => {
      const msgs = this.s.messages.filter(m => m.hitId === r.id);
      const last = msgs[msgs.length - 1];
      const seen = reads[r.id] ?? '';
      return { hitId: r.id, lastBody: last?.body ?? null, lastSenderId: last?.senderId ?? null, lastAt: last?.createdAt ?? null,
        unread: msgs.filter(m => m.senderId !== ME && m.createdAt > seen).length };
    });
  }
  async markRead(id: string) {
    await this.load();
    this.s.reads = { ...(this.s.reads ?? {}), [id]: iso(new Date()) };
    void AsyncStorage.setItem(KEY, JSON.stringify(this.s)).catch(() => {});
  }
  async confirmPlayed(id: string, didPlay: boolean) {
    await this.load();
    const r = this.find(id);
    r.confirmations[ME] = didPlay;
    const otherId = r.fromId === ME ? r.toId : r.fromId;
    r.confirmations[otherId] = didPlay;    // demo: they agree
    if (didPlay) r.state = 'completed';
    this.save(); return this.toRequest(r);
  }

  // ---- coaches: you as a coach ------------------------------------------------
  private rosterStatus(id: string): CoachStatus {
    const p = SEED.find(x => x.id === id); const c = this.s.coaching;
    if (!p || !c) return 'inactive';
    if (p.band === 'adult') return 'active';
    if (WAITING_ON_PARENT.has(id)) return 'parent';
    return new Date(c.verifyAt).getTime() <= Date.now() ? 'active' : 'verify';
  }
  async myCoaching(): Promise<Coaching | null> {
    await this.load(); const c = this.s.coaching;
    return c ? { academy: c.academy, code: c.code, juniorsVerified: new Date(c.verifyAt).getTime() <= Date.now() } : null;
  }
  async becomeCoach(academy: string): Promise<Coaching> {
    await this.load(); await this.wait();
    if (this.myBand() !== 'adult') throw new ApiError('Coaches are adults.');
    if (academy.trim().length < 2) throw new ApiError('Name your academy or team.');
    const code = academy.replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase() + String(Math.floor(Math.random() * 90) + 10);
    this.s.coaching = this.s.coaching ? { ...this.s.coaching, academy: academy.trim() } : { academy: academy.trim(), code, verifyAt: iso(new Date(Date.now() + 8000)) };
    this.save(); return (await this.myCoaching())!;
  }
  async coachRoster(): Promise<RosterMember[]> {
    await this.load(); if (!this.s.coaching) return [];
    const joined = (i: number) => hoursAgo(24 * (3 + i));
    return ROSTER.map((id, i) => {
      const p = SEED.find(x => x.id === id)!; const status = this.rosterStatus(id); const ok = status === 'active';
      const base = this.toPlayer(p, this.meProfile()?.levelValue ?? null);
      return ok ? { ...base, age: p.band === 'minor' ? p.age ?? null : null, levelDelta: null, distanceBucket: null, band: p.band, status, joinedAt: joined(i) }
        : { ...base, lastInitial: null, photoUrl: null, levelValue: null, levelSource: null, levelVerified: false, levelDelta: null, distanceBucket: null,
            homeCourtId: null, homeCourtName: null, availabilityMask: 0, lookingToHit: false, hitsConfirmed: 0, prefers: null, age: null,
            responseRate: null, acceptRate: null, band: p.band, status, joinedAt: joined(i) };
    }).sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || a.displayName.localeCompare(b.displayName));
  }
  async coachPair(aId: string, bId: string, courtId: string | null, start: Date | null, end: Date | null, note: string | null) {
    await this.load(); await this.wait();
    if (!this.s.coaching) throw new ApiError('Turn on coach tools first.');
    if (aId === bId) throw new ApiError('Pick two different players.');
    if (this.rosterStatus(aId) !== 'active' || this.rosterStatus(bId) !== 'active') throw new ApiError('Both players need to be on your roster.');
    const a = SEED.find(x => x.id === aId)!, b = SEED.find(x => x.id === bId)!;
    if (a.band !== b.band) throw new ApiError('Juniors are only paired with juniors.');
    if (start && start < new Date()) throw new ApiError('Pick a time that has not passed.');
    const pairs = this.s.coachPairs ?? [];
    if (pairs.some(x => x.state === 'open' && ((x.aId === aId && x.bId === bId) || (x.aId === bId && x.bId === aId)))) throw new ApiError('You already paired these two.');
    pairs.unshift({ id: uid(), aId, bId, courtId, windowStart: start ? iso(start) : null, windowEnd: end ? iso(end) : null, note: note?.trim() || null, state: 'open', hitState: null, createdAt: iso(new Date()) });
    this.s.coachPairs = pairs; this.save();
  }
  async coachPairings(): Promise<CoachPairing[]> {
    await this.load();
    const nm = (id: string) => SEED.find(x => x.id === id)?.name ?? 'Player';
    return (this.s.coachPairs ?? []).map(x => ({ ...x, aName: nm(x.aId), bName: nm(x.bId) }));
  }
  async coachRemove(playerId: string) {
    await this.load();
    (this.s.coachPairs ?? []).forEach(x => { if (x.state === 'open' && (x.aId === playerId || x.bId === playerId)) x.state = 'dismissed'; });
    this.save();
  }

  // ---- coaches: you as a player ------------------------------------------------
  async checkCoachCode(code: string) {
    await this.load(); await this.wait(200);
    return code.trim().toUpperCase() === COACH.code ? { coachName: COACH.name, academy: COACH.academy } : null;
  }
  async joinCoach(code: string) {
    await this.load(); await this.wait();
    if (code.trim().toUpperCase() !== COACH.code) throw new ApiError('That code is not a coach on Hits. Check it with them.');
    const minor = this.myBand() === 'minor';
    this.s.myCoach = { status: minor ? 'parent' : 'active', joinedAt: iso(new Date()) };
    this.save();
    return { coachName: COACH.name, academy: COACH.academy, needsParent: minor };
  }
  async myCoaches(): Promise<MyCoach[]> {
    await this.load(); const m = this.s.myCoach;
    return m ? [{ coachId: COACH.id, name: COACH.name, academy: COACH.academy, status: m.status }] : [];
  }
  async leaveCoach() {
    await this.load(); this.s.myCoach = null;
    (this.s.pairings ?? []).forEach(x => { if (x.state === 'open') x.state = 'dismissed'; });
    this.save();
  }
  // The coach's suggestion: someone your level and age, free when you are, at their court.
  private coachSuggests() {
    const me = this.s.profile; if (!me) return;
    const band = bandOf(me.dateOfBirth);
    const pick = SEED.filter(p => p.band === band && !this.s.blocked.includes(p.id) && this.ageOk(p, band === 'minor' ? 2 : null))
      .sort((a, b) => Number(b.looking) - Number(a.looking) || Math.abs(a.level - me.levelValue) - Math.abs(b.level - me.levelValue))[0];
    if (!pick) return;
    const start = nextSlot(pick.avail & me.availabilityMask || pick.avail, 2);
    const court = midpointCourt(me.homeCourtId, pick.court, COURTS.map(c => c.id)) ?? pick.court;
    const id = uid();
    this.s.pairings = [{ id, otherId: pick.id, courtId: court, windowStart: iso(start), windowEnd: iso(new Date(start.getTime() + 90 * 60000)),
      note: 'You two have similar games. Start with cross-court rallies, then play a set.', state: 'open', createdAt: iso(new Date()) }, ...(this.s.pairings ?? [])];
    void notifyLocal(`Coach ${COACH.name.split(' ')[0]} paired you with ${pick.name}`, `${start.toLocaleString('en-US', { weekday: 'short', hour: 'numeric' })} · ${COURTS.find(c => c.id === court)?.name ?? ''}`, { pairing: id });
  }
  async myPairings(): Promise<Pairing[]> {
    await this.load();
    if (this.s.myCoach?.status !== 'active') return [];
    return (this.s.pairings ?? []).filter(x => x.state === 'open').flatMap(x => {
      const p = SEED.find(s => s.id === x.otherId); if (!p) return [];
      return [{ id: x.id, coachId: COACH.id, coachName: COACH.name, academy: COACH.academy, other: this.toPlayer(p, this.meProfile()?.levelValue ?? null),
        courtId: x.courtId, windowStart: x.windowStart, windowEnd: x.windowEnd, note: x.note, createdAt: x.createdAt }];
    });
  }
  async pairingSent(pairingId: string) { await this.load(); const x = (this.s.pairings ?? []).find(y => y.id === pairingId); if (x) { x.state = 'sent'; this.save(); } }
  async dismissPairing(pairingId: string) { await this.load(); const x = (this.s.pairings ?? []).find(y => y.id === pairingId); if (x) { x.state = 'dismissed'; this.save(); } }

  // ---- coaches: you as a parent ------------------------------------------------
  async guardianCoachLinks(): Promise<GuardianCoachLink[]> {
    await this.load(); const m = this.s.myCoach; const p = this.s.profile;
    if (!m || !p || bandOf(p.dateOfBirth) !== 'minor') return [];
    return [{ childId: ME, childName: p.displayName, coachId: COACH.id, coachName: COACH.name, academy: COACH.academy, approved: m.status !== 'parent', coachVerified: true }];
  }
  async guardianDecideCoach(_child: string, _coach: string, ok: boolean) {
    await this.load();
    if (!this.s.myCoach) return;
    if (ok) { this.s.myCoach.status = 'active'; this.s.myCoach.joinedAt = iso(new Date()); }
    else this.s.myCoach = null;
    this.save();
  }

  // ---- doubles -------------------------------------------------------------------
  async doublesMatch(matchId: string): Promise<DoublesMember[]> {
    await this.load();
    const game = this.s.requests.filter(r => r.matchId === matchId);
    const me = this.meProfile(); if (!game.length || !me) return [];
    const members: DoublesMember[] = [{ id: ME, displayName: me.displayName, lastInitial: me.lastInitial, photoUrl: me.photoUrl, levelValue: me.levelValue, age: me.age, role: 'organizer', state: null, hitId: null }];
    for (const r of game) {
      const p = SEED.find(x => x.id === r.toId); if (!p) continue;
      members.push({ id: p.id, displayName: p.name, lastInitial: p.initial, photoUrl: null, levelValue: p.level,
        age: p.band === 'minor' && this.myBand() === 'minor' ? p.age ?? null : null, role: r.doublesRole ?? 'partner', state: r.state, hitId: r.id });
    }
    return members.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  }
  async suggestDoubles(hitId: string | null, _role: DoublesRole): Promise<DoublesSuggestion[]> {
    await this.load(); await this.wait(160);
    const me = this.meProfile(); if (!me || !this.s.cohortOpen) return [];
    let members: SeedPlayer[] = [];
    if (hitId) {
      const h = this.find(hitId);
      if (h.fromId !== ME || h.format !== 'doubles') throw new ApiError('Only the player who set up the doubles game invites the others.');
      const ids = this.s.requests.filter(r => r.matchId === h.matchId && LIVE.includes(r.state)).map(r => r.toId);
      members = SEED.filter(p => ids.includes(p.id));
    }
    const levels = [me.levelValue ?? 8, ...members.map(m => m.level)];
    const team = levels.reduce((a, b) => a + b, 0) / levels.length;
    const mask = members.reduce((m, p) => m & p.avail, me.availabilityMask || 63);
    const bits = (n: number) => [1, 2, 4, 8, 16, 32].filter(b => n & b).length;
    return SEED
      .filter(p => p.band === me.band && !this.s.blocked.includes(p.id) && this.ageOk(p, null) && p.activeHoursAgo < 24 * 30)
      .filter(p => fmtOf(p) !== 'singles' && !members.some(m => m.id === p.id))
      .sort((a, b) => Math.abs(a.level - team) - Math.abs(b.level - team) || bits(b.avail & mask) - bits(a.avail & mask) || Number(b.looking) - Number(a.looking))
      .slice(0, 30)
      .map(p => ({ ...this.toPlayer(p, me.levelValue), commonTimes: bits(p.avail & mask) }));
  }

  // ---- tournaments ---------------------------------------------------------------
  private allTournaments() {
    const band = this.myBand();
    const seeded = TOURNAMENTS.filter(t => t.band === band).map(t => ({ id: t.id, name: t.name, startsOn: satPlus(t.startIn), endsOn: satPlus(t.startIn + t.days - 1), location: t.location, url: null as string | null }));
    return [...seeded, ...(this.s.addedTournaments ?? [])];
  }
  private entriesOf(id: string): Record<string, TournamentEntry> {
    const t = TOURNAMENTS.find(x => x.id === id);
    return { ...(t ? seedEntries(t) : {}), ...(this.s.entries?.[id] ?? {}) };
  }
  async tournaments(childId?: string): Promise<Tournament[]> {
    await this.load();
    const who = childId ?? ME;
    const today = localDate(new Date());
    return this.allTournaments().filter(t => t.endsOn >= today).sort((a, b) => a.startsOn.localeCompare(b.startsOn)).map(t => {
      const all = this.entriesOf(t.id); const mine = all[who];
      const seen = Object.entries(all).filter(([pid]) => pid !== ME && pid !== SIBLING.id && this.visibleSeed(pid));
      return { ...t, entered: !!mine, division: mine?.division ?? null, singles: !!mine?.singles, doubles: !!mine?.doubles, wantsPartner: !!mine?.wantsPartner,
        players: seen.length, partnerSeekers: seen.filter(([, e]) => e.wantsPartner).length };
    });
  }
  private visibleSeed(id: string) {
    const p = SEED.find(x => x.id === id);
    return !!p && this.s.cohortOpen && p.band === this.myBand() && !this.s.blocked.includes(p.id) && this.ageOk(p, null);
  }
  async addTournament(name: string, startsOn: string, endsOn: string, location: string | null, url: string | null) {
    await this.load(); await this.wait();
    const n = name.trim().replace(/\s+/g, ' ');
    if (n.length < 3) throw new ApiError('Give the tournament its name.');
    const today = localDate(new Date());
    if (startsOn < today) throw new ApiError("Pick a date that hasn't passed.");
    if (endsOn < startsOn) throw new ApiError('The last day has to be on or after the first.');
    if (url && !/^https:\/\//.test(url.trim())) throw new ApiError('A link has to start with https://');
    const same = this.allTournaments().find(t => t.name.toLowerCase() === n.toLowerCase() && t.startsOn === startsOn);
    if (same) return same.id;
    const id = 't-' + uid();
    this.s.addedTournaments = [...(this.s.addedTournaments ?? []), { id, name: n, startsOn, endsOn, location: location?.trim() || null, url: url?.trim() || null }];
    this.save(); return id;
  }
  async enterTournament(id: string, e: TournamentEntry, childId?: string) {
    await this.load();
    if (!e.singles && !e.doubles) throw new ApiError('Pick singles, doubles or both.');
    const division = e.division?.trim().toUpperCase() || null;
    if (division && division.length > 12) throw new ApiError('Keep the division short, like 14U or 4.0.');
    const all = { ...(this.s.entries ?? {}) };
    all[id] = { ...(all[id] ?? {}), [childId ?? ME]: { division, singles: e.singles, doubles: e.doubles, wantsPartner: e.doubles && e.wantsPartner } };
    this.s.entries = all; this.save();
  }
  async leaveTournament(id: string, childId?: string) {
    await this.load();
    const all = { ...(this.s.entries ?? {}) }; const t = { ...(all[id] ?? {}) };
    delete t[childId ?? ME]; all[id] = t; this.s.entries = all; this.save();
  }
  async tournamentPlayers(id: string): Promise<TournamentPlayer[]> {
    await this.load(); await this.wait(150);
    const all = this.entriesOf(id); const mine = all[ME]?.division ?? null; const myLevel = this.meProfile()?.levelValue ?? 8;
    return Object.entries(all).filter(([pid]) => this.visibleSeed(pid)).map(([pid, e]) => {
      const p = SEED.find(x => x.id === pid)!;
      return { id: p.id, displayName: p.name, lastInitial: p.initial, photoUrl: null, levelValue: p.level, levelSource: p.verified ? 'utr_verified' as const : 'utr_self' as const,
        age: p.band === 'minor' ? p.age ?? null : null, division: e.division, singles: e.singles, doubles: e.doubles, wantsPartner: e.wantsPartner,
        sameDivision: !!mine && e.division === mine, availabilityMask: p.avail, homeCourtId: p.court };
    }).sort((a, b) => Number(b.sameDivision) - Number(a.sameDivision) || Number(b.wantsPartner) - Number(a.wantsPartner)
      || Math.abs((a.levelValue ?? 0) - myLevel) - Math.abs((b.levelValue ?? 0) - myLevel) || a.displayName.localeCompare(b.displayName));
  }

  // ---- safety ------------------------------------------------------------------
  async block(profileId: string) {
    await this.load(); if (!this.s.blocked.includes(profileId)) this.s.blocked.push(profileId);
    this.s.requests.filter(r => r.fromId === profileId || r.toId === profileId).forEach(r => { if (!['completed'].includes(r.state)) r.state = 'cancelled'; });
    this.save();
  }
  // The demo has nobody to escalate to, but dropping the report silently made the
  // flow untestable. Keep it where a walkthrough can see it landed.
  async report(profileId: string, reason: string, body: string, hitId?: string) {
    await this.load();
    this.s.reports = [...(this.s.reports ?? []), { profileId, reason, body, hitId: hitId ?? null, at: iso(new Date()) }];
    this.save();
  }

  // ---- guardian ----------------------------------------------------------------
  async inviteGuardian(email: string, phone: string) {
    await this.load(); if (!this.s.profile) throw new ApiError('no profile');
    this.s.profile.guardianEmail = email; this.s.profile.guardianPhone = phone; this.s.profile.guardianVerified = false;
    this.s.profile.guardianSentAt = iso(new Date()); this.s.profile.guardianOpenedAt = null;
    // In the demo the parent opens the text in a few seconds and says yes soon after.
    this.later(4000, () => { if (this.s.profile) this.s.profile.guardianOpenedAt = iso(new Date()); });
    this.later(8000, () => { if (this.s.profile) { this.s.profile.guardianVerified = true; void notifyLocal('Your parent said yes', 'You can reach out now.'); } });
    this.save();
  }
  async guardianChildren(): Promise<GuardianChild[]> {
    await this.load();
    const me = this.meProfile(); if (!me || me.band !== 'minor') return [];
    const rows = this.s.requests.filter(r => r.fromId === ME || r.toId === ME);
    const pending = rows.flatMap(r => r.approvals.filter(a => a.minorId === ME && a.decision == null).map(a => ({ ...a, request: this.toRequest(r) })));
    const upcoming = rows.filter(r => r.state === 'confirmed' && new Date(r.windowEnd) > new Date()).map(r => this.toRequest(r));
    const kids: GuardianChild[] = [{ profile: me, pendingApprovals: pending, upcoming }];
    if (me.guardianVerified && !this.s.siblingRevoked) kids.push({ profile: this.sibling(), pendingApprovals: [], upcoming: this.siblingRows().map(r => this.toRequest(r, SIBLING.id)) });
    return kids;
  }
  private sibling(): Profile {
    return {
      id: SIBLING.id, displayName: SIBLING.name, lastInitial: SIBLING.initial, photoUrl: null, band: 'minor',
      levelValue: SIBLING.level, levelSource: 'utr_self', homeCourtId: SIBLING.court, availabilityMask: SIBLING.avail,
      lastActiveAt: hoursAgo(5), lookingToHitUntil: null, responseRate: 1, acceptRate: 0.9, hitsConfirmed: 4,
      phoneVerified: true, guardianVerified: true, guardianPending: false, guardianSentAt: null, guardianOpenedAt: null,
      rosterName: null, prefers: 'Rally & drills', age: SIBLING.age, maxPartnerAgeGap: this.s.siblingGap === undefined ? 2 : this.s.siblingGap,
      playFormat: 'either',
    };
  }
  // Her one hit this week, with a girl her age. Rebuilt from today so it never goes stale.
  private siblingRows(): Row[] {
    const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); d.setHours(10, 0, 0, 0);
    const r = row('p-iris', SIBLING.id, 'c-mitchell', d, 'Want to rally Saturday morning?', SIBLING.id);
    return [{ ...r, id: 'sib-hit-1', state: 'confirmed', awaitingId: null, confirmedAt: hoursAgo(20), createdAt: hoursAgo(30),
      approvals: [
        { hitId: 'sib-hit-1', minorId: SIBLING.id, minorName: SIBLING.name, guardianUserId: GUARDIAN, decision: true, decidedAt: hoursAgo(20) },
        { hitId: 'sib-hit-1', minorId: 'p-iris', minorName: 'Iris', guardianUserId: 'g-p-iris', decision: true, decidedAt: hoursAgo(22) },
      ] }];
  }
  async setChildAgeGap(childId: string, gap: number | null) {
    await this.load();
    if (gap != null && (gap < 1 || gap > 5)) throw new ApiError('Pick between one and five years, or anyone under 18.');
    if (childId === SIBLING.id) this.s.siblingGap = gap;
    else if (this.s.profile) this.s.profile.maxPartnerAgeGap = gap;
    this.save();
  }
  async guardianDecide(hitId: string, minorId: string, decision: boolean) {
    await this.load(); await this.wait();
    const r = this.find(hitId);
    const a = r.approvals.find(x => x.minorId === minorId); if (!a) throw new ApiError('Nothing to approve');
    a.decision = decision; a.decidedAt = iso(new Date());
    if (decision) this.maybeConfirm(r); else { r.state = 'declined'; r.declineReason = 'A parent passed on this one'; }
    this.save(); return a;
  }
  async guardianBlock(_childId: string, profileId: string) { await this.block(profileId); }
  async guardianLinkPreview() { await this.load(); return this.s.profile ? { childName: this.s.profile.displayName, verified: this.s.profile.guardianVerified } : null; }
  async guardianLinkOpened() { await this.load(); if (this.s.profile && !this.s.profile.guardianOpenedAt) { this.s.profile.guardianOpenedAt = iso(new Date()); this.save(); } }
  async guardianAccept() { await this.load(); if (this.s.profile) { this.s.profile.guardianVerified = true; this.s.profile.guardianOpenedAt ??= iso(new Date()); this.save(); } }
  async guardianRevoke(linkId?: string) {
    await this.load(); if (!this.s.profile) return;
    if (linkId === 'link-lily') { this.s.siblingRevoked = true; this.save(); return; }
    this.s.profile.guardianVerified = false; this.s.profile.guardianEmail = null; this.s.profile.guardianSentAt = null; this.s.profile.guardianOpenedAt = null;
    this.s.requests.forEach(r => { if (['pending', 'countered', 'accepted', 'confirmed'].includes(r.state)) { r.state = 'cancelled'; r.awaitingId = null; } });
    this.save();
  }
  async guardianLinks() {
    await this.load();
    return this.s.profile?.guardianVerified
      ? [{ id: 'link-demo', childId: ME, childName: this.s.profile.displayName, verifiedAt: iso(new Date()) },
         ...(this.s.siblingRevoked ? [] : [{ id: 'link-lily', childId: SIBLING.id, childName: SIBLING.name, verifiedAt: hoursAgo(24 * 120) }])]
      : [];
  }
  async assurance(hitId: string): Promise<Assurance | null> {
    await this.load();
    const r = this.s.requests.find(x => x.id === hitId) ?? this.siblingRows().find(x => x.id === hitId); if (!r) return null;
    const otherId = r.fromId === ME || r.fromId === SIBLING.id ? r.toId : r.fromId;
    const seed = SEED.find(p => p.id === otherId); if (!seed) return null;
    const approvals = r.approvals.find(a => a.minorId === otherId);
    return {
      otherGuardianVerified: seed.band === 'minor', otherGuardianMonths: seed.band === 'minor' ? 4 + (seed.hits % 5) : null,
      otherGuardianApprovals: seed.band === 'minor' ? Math.max(approvals?.decision ? 1 : 0, Math.round(seed.hits * 0.6)) : 0,
      otherPlayerHits: seed.hits, otherPlayerReports: 0, otherPlayerMemberMonths: 3 + (seed.hits % 7),
      otherPlayerLevelVerified: !!seed.verified, bothMinors: seed.band === 'minor' && this.myBand() === 'minor',
    };
  }
  async guardianHit(hitId: string) {
    await this.load();
    const sib = this.siblingRows().find(x => x.id === hitId);
    if (sib) return { request: this.toRequest(sib, SIBLING.id), messages: [
      { id: 'sm1', hitId, senderId: 'p-iris', body: 'Want to rally Saturday morning?', createdAt: hoursAgo(30) },
      { id: 'sm2', hitId, senderId: SIBLING.id, body: 'Yes! My mom can drive me.', createdAt: hoursAgo(29) },
    ], child: this.sibling() };
    const r = this.s.requests.find(x => x.id === hitId); if (!r) return null;
    return { request: this.toRequest(r), messages: this.s.messages.filter(m => m.hitId === hitId), child: this.meProfile()! };
  }
}

const LIVE: HitState[] = ['pending', 'countered', 'accepted', 'confirmed'];
const ROLE_ORDER: Record<DoublesMember['role'], number> = { organizer: 0, partner: 1, opponent: 2 };

// Next occurrence of an availability slot, starting `fromDays` from now.
export function nextSlot(mask: number, fromDays = 1): Date {
  const bits = [1, 2, 4, 8, 16, 32].filter(b => mask & b);
  const bit = bits[0] ?? 8;
  const weekend = bit >= 8;
  const hour = bit === 1 || bit === 8 ? 9 : bit === 2 || bit === 16 ? 14 : 18;
  const d = new Date(); d.setDate(d.getDate() + fromDays); d.setHours(hour, 0, 0, 0);
  for (let i = 0; i < 8; i++) {
    const isWknd = d.getDay() === 0 || d.getDay() === 6;
    if (isWknd === weekend) return d;
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function row(fromId: string, toId: string, courtId: string, start: Date, note: string | null, awaitingId: string, end?: Date): Row {
  const e = end ?? new Date(start.getTime() + 90 * 60000);
  return {
    id: uid(), fromId, toId, courtId, windowStart: iso(start), windowEnd: iso(e), note,
    state: 'pending', awaitingId, expiresAt: iso(new Date(Date.now() + 72 * 3600000)),
    createdAt: iso(new Date()), confirmedAt: null, declineReason: null, approvals: [], confirmations: {},
    // The person asking brings the balls, the same default the database sets.
    plan: { ...emptyPlan(), ballsById: fromId },
  };
}
