import type {
  Approval, Assurance, Court, HitPlan, Roster, DeclineReason, DiscoverFilters, GuardianChild, HitRequest,
  MarketStatus, Message, Player, Profile, ProfileInput, Session,
} from './types';

// The one interface the screens talk to. Two implementations: `supabase` for the real
// backend, `demo` for an in-memory walkthrough with seeded Boston players.
export interface HitsApi {
  readonly mode: 'supabase' | 'demo';

  // auth
  restore(): Promise<Session | null>;
  sendCode(phone: string): Promise<void>;
  verifyCode(phone: string, code: string): Promise<Session>;
  signOut(): Promise<void>;

  // me
  me(): Promise<Profile | null>;
  createProfile(input: ProfileInput): Promise<Profile>;
  updateProfile(patch: Partial<Pick<Profile, 'availabilityMask' | 'homeCourtId' | 'displayName' | 'levelValue' | 'levelSource'>>): Promise<Profile>;
  setLooking(days: number | null): Promise<Profile>;
  setLocation(lat: number, lon: number): Promise<void>;
  touch(): Promise<void>;

  // market + courts
  marketStatus(): Promise<MarketStatus | null>;
  courts(): Promise<Court[]>;
  // Before a profile exists: a taste of what's out there, computed from level alone.
  peek(levelValue: number, band: 'minor' | 'adult'): Promise<{ count: number; sample: Player[] }>;

  // discovery
  discover(filters: DiscoverFilters): Promise<Player[]>;
  player(id: string): Promise<Player | null>;

  // hits
  requests(): Promise<HitRequest[]>;
  hit(id: string): Promise<{ request: HitRequest; messages: Message[] } | null>;
  sendRequest(toId: string, courtId: string, windowStart: Date, windowEnd: Date, note: string | null): Promise<HitRequest>;
  cancelRequest(id: string): Promise<void>;
  accept(id: string): Promise<HitRequest>;
  decline(id: string, reason: DeclineReason): Promise<HitRequest>;
  counter(id: string, courtId: string, windowStart: Date, windowEnd: Date): Promise<HitRequest>;
  sendMessage(id: string, body: string): Promise<Message>;
  confirmPlayed(id: string, didPlay: boolean): Promise<HitRequest>;
  updatePlan(id: string, patch: Partial<HitPlan>): Promise<HitRequest>;
  setPushToken(token: string): Promise<void>;

  // rosters: one code brings a whole team
  createRoster(name: string, cap: number): Promise<Roster>;
  myRosters(): Promise<Roster[]>;
  checkCode(code: string): Promise<{ valid: boolean; rosterName: string | null }>;

  // safety
  block(profileId: string): Promise<void>;
  report(profileId: string, reason: string, body: string, hitId?: string): Promise<void>;

  // guardian
  inviteGuardian(email: string, phone: string): Promise<void>;
  guardianChildren(): Promise<GuardianChild[]>;
  guardianDecide(hitId: string, minorId: string, decision: boolean): Promise<Approval>;
  guardianHit(hitId: string): Promise<{ request: HitRequest; messages: Message[]; child: Profile } | null>;
  guardianBlock(childId: string, profileId: string): Promise<void>;
  assurance(hitId: string): Promise<Assurance | null>;

  // subscriptions (lightweight; demo uses a tick)
  onChange(cb: () => void): () => void;
}

export class ApiError extends Error {
  constructor(message: string, public code: string = 'error') { super(message); }
}
