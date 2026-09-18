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
}

// Planned together while the parents decide. Small, one-tap choices both sides see.
export interface HitPlan {
  ballsBy: 'me' | 'them' | null;      // relative to the viewer? No: stored as a profile id
  ballsById: string | null;
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
}

export interface Court {
  id: string;
  name: string;
  access: 'public' | 'club';
  indoor: boolean;
  surface: string | null;
  distanceBucket: string | null;
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
}

export interface ProfileInput {
  displayName: string;
  lastInitial: string;
  dateOfBirth: string;           // YYYY-MM-DD
  levelValue: number;
  levelSource: LevelSource;
  homeCourtId: string;
  availabilityMask: number;
  rosterCode?: string | null;
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
