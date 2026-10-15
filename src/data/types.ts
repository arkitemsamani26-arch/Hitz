export type AgeBand = 'minor' | 'adult';
export type LevelSource = 'utr_verified' | 'utr_self' | 'estimated';
export type HitState =
  | 'pending' | 'countered' | 'accepted' | 'confirmed'
  | 'declined' | 'cancelled' | 'expired' | 'completed';

export interface Profile {
  id: string;
  displayName: string;
  lastInitial: string | null;
  photoUrl: string | null;
  band: AgeBand;
  levelValue: number | null;
  levelSource: LevelSource | null;
  homeCourtId: string | null;
  availabilityMask: number;
  lastActiveAt: string;
  lookingToHitUntil: string | null;
  responseRate: number | null;
  acceptRate: number | null;
  hitsConfirmed: number;
  phoneVerified: boolean;
  guardianVerified: boolean;      // minors only; false for adults is meaningless
  guardianPending: boolean;
  guardianSentAt: string | null;
  guardianOpenedAt: string | null;  // the parent tapped the link
  rosterName: string | null;
  photoPendingUrl?: string | null;  // a minor's photo awaiting the parent
  // What kind of hit they are after, in their words: "Practice sets", "Rally & drills".
  prefers: string | null;
  // Juniors only, in years. Adults' ages are not shown to anyone.
  age: number | null;
  // Juniors only: how far apart in age their partners may be, set by a parent. Null is any.
  maxPartnerAgeGap: number | null;
}

// Planned together while the parents decide. Small, one-tap choices both sides see.
export interface HitPlan {
  ballsById: string | null;           // who is bringing them, as a profile id
  format: 'sets' | 'drills' | 'both' | null;
  meetAt: 'gate' | 'court' | null;
  lateById: string | null;            // who flagged "running 5 late"
}

// What a parent can honestly be told about the other side without identifying anyone.
export interface Assurance {
  otherGuardianVerified: boolean;
  otherGuardianMonths: number | null;   // how long ago they verified
  otherGuardianApprovals: number;       // hits they've approved before
  otherPlayerHits: number;
  otherPlayerReports: number;
  otherPlayerMemberMonths: number;
  otherPlayerLevelVerified: boolean;
  bothMinors: boolean;
}

// A personal invite: one player bringing one friend. Carries no visibility privilege --
// it records who brought whom, and gives the new player a name to arrive to.
export interface Invite {
  code: string;
  redeemed: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface Roster {
  id: string;
  name: string;
  code: string;
  cap: number;
  joined: number;
  createdAt: string;
}

// What discovery returns about someone else. Never a precise location.
export interface Player {
  id: string;
  displayName: string;
  lastInitial: string | null;
  photoUrl: string | null;
  levelValue: number | null;
  levelSource: LevelSource | null;
  levelVerified: boolean;
  levelDelta: number | null;
  distanceBucket: string | null;
  homeCourtId: string | null;
  homeCourtName: string | null;
  availabilityMask: number;
  lookingToHit: boolean;
  lastActiveAt: string;
  responseRate: number | null;
  acceptRate: number | null;
  hitsConfirmed: number;
  prefers: string | null;
  // In years, and only when both of you are under 18.
  age: number | null;
}

export interface Court {
  id: string;
  name: string;
  access: 'public' | 'club';
  indoor: boolean;
  surface: string | null;
  distanceBucket: string | null;
  // City-level, for directions. Never a pin we have not checked.
  address?: string | null;
}

export interface HitRequest {
  id: string;
  fromId: string;
  toId: string;
  courtId: string;
  courtName: string;
  windowStart: string;
  windowEnd: string;
  note: string | null;
  state: HitState;
  awaitingId: string | null;
  expiresAt: string;
  createdAt: string;
  confirmedAt: string | null;
  declineReason: string | null;
  other: Player;                 // the participant who is not me
  approvals: Approval[];         // one per minor participant, once accepted
  plan: HitPlan;
  myConfirmation: boolean | null;
  theirConfirmation: boolean | null;
}

export interface Approval {
  hitId: string;
  minorId: string;
  minorName: string;
  guardianUserId: string;
  decision: boolean | null;
  decidedAt: string | null;
  createdAt?: string;
  seenAt?: string | null;        // the parent has looked at it
}

export interface Message {
  id: string;
  hitId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

// One line of the Messages tab: the hit, its latest message, and what you have not read.
export interface InboxEntry {
  hitId: string;
  lastBody: string | null;
  lastSenderId: string | null;
  lastAt: string | null;
  unread: number;
}

// How many players you could invite call a court home. A count, never a list of names.
export interface CourtStats {
  courtId: string;
  players: number;
  looking: number;
}

export interface MarketStatus {
  marketSlug: string;
  marketName: string;
  band: AgeBand;
  activePlayers: number;
  minActivePlayers: number;
  discoveryOpen: boolean;
}

export interface DiscoverFilters {
  radiusMi: number;
  levelLo: number | null;
  levelHi: number | null;
  availability: number;
  onlyLooking: boolean;
  // Juniors: only players within this many years of your age. Null is any age.
  ageGap: number | null;
  // How many to bring back. Discover shows the closest 50; a court's page and search look
  // through everyone in range, because they filter afterwards.
  limit?: number;
}

// What UTR says about you, minus everything that must stay on the server. Absent means
// no link at all; present with a non-'rated' status means linked but not yet rated, which
// is a real UTR state and not the same as never having linked.
export interface UtrStatus {
  playerId: string | null;
  rating: number | null;
  ratingStatus: 'rated' | 'projected' | 'unrated' | string;
  linkedAt: string | null;
  syncedAt: string | null;
}

// A player's standing claim on a UTR, checked by a person against utrsports.net. The
// badge it leads to is the same one the Engage API grants; only the provenance differs.
export interface UtrClaim {
  id: string;
  claimedRating: number;
  profileUrl: string;
  fullName: string;
  state: 'pending' | 'approved' | 'rejected';
  decidedRating: number | null;
  reviewerNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface ProfileInput {
  displayName: string;
  lastInitial: string;
  dateOfBirth: string;           // YYYY-MM-DD
  levelValue: number;
  levelSource: LevelSource;
  homeCourtId: string;
  availabilityMask: number;
  joinCode?: string | null;
}

export interface GuardianChild {
  profile: Profile;
  pendingApprovals: (Approval & { request: HitRequest })[];
  upcoming: HitRequest[];
}

export interface Session {
  userId: string;
  phone: string;
  /** true when this user is signed in as a guardian rather than a player */
  isGuardian: boolean;
}

export type DeclineReason = 'not_this_week' | 'too_far' | 'level_off' | 'cant';

export const DECLINE_COPY: Record<DeclineReason, string> = {
  not_this_week: 'Not this week',
  too_far: 'Too far for me',
  level_off: "Level's a bit off",
  cant: "Can't make it work",
};

// Availability bitmask -- coarse on purpose. Calendars are where scheduling apps die.
export const SLOTS = [
  { bit: 1,  label: 'Weekday',  part: 'Morning' },
  { bit: 2,  label: 'Weekday',  part: 'Afternoon' },
  { bit: 4,  label: 'Weekday',  part: 'Evening' },
  { bit: 8,  label: 'Weekend',  part: 'Morning' },
  { bit: 16, label: 'Weekend',  part: 'Afternoon' },
  { bit: 32, label: 'Weekend',  part: 'Evening' },
] as const;

export function slotsOf(mask: number): string[] {
  return SLOTS.filter(s => mask & s.bit).map(s => `${s.label} ${s.part.toLowerCase()}s`);
}

// The same, in one short line: "Evenings, any day", "Weekday evenings, weekend mornings".
export function slotsSummary(mask: number): string {
  if (!mask) return 'Not set';
  const all = SLOTS.reduce((m, s) => m | s.bit, 0);
  if (mask === all) return 'Any time';
  const wk = mask & 7, we = (mask >> 3) & 7;
  const parts = (m: number) => ['mornings', 'afternoons', 'evenings'].filter((_, i) => m & (1 << i));
  const list = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (wk === we) return `${cap(list(parts(wk)))}, any day`;
  const out: string[] = [];
  if (wk) out.push(`weekday ${list(parts(wk))}`);
  if (we) out.push(`weekend ${list(parts(we))}`);
  return cap(out.join(', '));
}

// Coaches ------------------------------------------------------------------------------------
// Where a player stands on a coach's roster. A junior waits on their parent ('parent'), then
// on Hits verifying the coach ('verify'), before the coach can see or pair them.
export type CoachStatus = 'active' | 'parent' | 'verify' | 'inactive';

// Your own coach tools, if you have turned them on.
export interface Coaching {
  academy: string;
  code: string;
  juniorsVerified: boolean;
}

// A player on your roster. Until they are 'active', only their first name is filled in.
export interface RosterMember extends Player {
  band: AgeBand;
  status: CoachStatus;
  joinedAt: string;
}

// A pairing you made, and how it went: the hit's state, never what was said.
export interface CoachPairing {
  id: string;
  aId: string; aName: string;
  bId: string; bName: string;
  courtId: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  note: string | null;
  state: 'open' | 'sent' | 'dismissed';
  hitState: HitState | null;
  createdAt: string;
}

// A coach you have joined.
export interface MyCoach {
  coachId: string;
  name: string;
  academy: string;
  status: CoachStatus;
}

// A coach's suggestion that you hit with someone.
export interface Pairing {
  id: string;
  coachId: string;
  coachName: string;
  academy: string;
  other: Player;
  courtId: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  note: string | null;
  createdAt: string;
}

// For a parent: a coach one of their children has joined, and whether they approved it.
export interface GuardianCoachLink {
  childId: string;
  childName: string;
  coachId: string;
  coachName: string;
  academy: string;
  approved: boolean;
  coachVerified: boolean;
}
