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
  // Before a profile exists: a taste of what's out there. The date of birth picks the
  // cohort, since a minor and an adult are looking at two different rooms.
  peek(levelValue: number, dateOfBirth: string): Promise<{ count: number; sample: Player[] }>;

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
  // Share your number for one confirmed hit. Off by default, revocable, per hit.
  sharePhone(id: string, share: boolean): Promise<void>;
  // UTR linking: returns the OAuth URL to open, or null when not configured.
  beginUtrLink(): Promise<string | null>;
  // Photos: a square JPEG as base64; returns the new profile. null removes it.
  setPhoto(base64: string | null): Promise<Profile>;
  guardianRemovePhoto(childId: string): Promise<void>;
  guardianApprovePhoto(childId: string, approve: boolean): Promise<void>;
  sharedPhones(id: string): Promise<{ profileId: string; phone: string; mine: boolean }[]>;
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
  // The parent's link page: preview before sign-in, mark opened, accept, revoke.
  guardianLinkPreview(linkId: string): Promise<{ childName: string; verified: boolean } | null>;
  guardianLinkOpened(linkId: string): Promise<void>;
  guardianAccept(linkId: string): Promise<void>;
  guardianRevoke(linkId: string): Promise<void>;
  guardianLinks(): Promise<{ id: string; childName: string; verifiedAt: string | null }[]>;
  assurance(hitId: string): Promise<Assurance | null>;

  // subscriptions (lightweight; demo uses a tick)
  onChange(cb: () => void): () => void;
}

export class ApiError extends Error {
  constructor(message: string, public code: string = 'error') { super(message); }
}
