// In-memory implementation with seeded Boston players.
//
// Exists so the product can be walked end to end -- onboarding, discovery, request,
// accept, the guardian gate, the confirmed moment -- without a backend. Other players
// respond on a short delay so the loop actually closes. State persists locally so a
// reload doesn't restart onboarding.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, type HitsApi } from './api';
import type {
  Approval, Court, DeclineReason, DiscoverFilters, GuardianChild, HitRequest, HitState,
  MarketStatus, Message, Player, Profile, ProfileInput, Session,
} from './types';
import { DECLINE_COPY } from './types';

const KEY = 'hits.demo.v3';
const ME = 'me';
const GUARDIAN = 'guardian-me';

type SeedPlayer = {
  id: string; name: string; initial: string; band: 'minor' | 'adult'; level: number;
  miles: number; activeHoursAgo: number; response: number | null; accept: number | null;
  looking: boolean; court: string; avail: number; hits: number; verified?: boolean;
};

const COURTS: Court[] = [
  { id: 'c-wellesley', name: 'Wellesley Town Courts', access: 'public', indoor: false, surface: 'hard', distanceBucket: 'under 1 mi' },
  { id: 'c-babson', name: 'Babson Indoor', access: 'club', indoor: true, surface: 'hard', distanceBucket: '~2 mi' },
  { id: 'c-needham', name: 'Needham High Courts', access: 'public', indoor: false, surface: 'hard', distanceBucket: '~4 mi' },
  { id: 'c-weston', name: 'Weston Town Courts', access: 'public', indoor: false, surface: 'hard', distanceBucket: '~5 mi' },
  { id: 'c-newton', name: 'Newton Commonwealth', access: 'public', indoor: false, surface: 'hard', distanceBucket: '~6 mi' },
  { id: 'c-longfellow', name: 'Longfellow Indoor', access: 'club', indoor: true, surface: 'hard', distanceBucket: '~7 mi' },
  { id: 'c-natick', name: 'Natick High Courts', access: 'public', indoor: false, surface: 'hard', distanceBucket: '~4 mi' },
  { id: 'c-brookline', name: 'Brookline High Courts', access: 'public', indoor: false, surface: 'hard', distanceBucket: '~9 mi' },
];

const SEED: SeedPlayer[] = [
  { id: 'p-maya', name: 'Maya', initial: 'R', band: 'minor', level: 8.6, miles: 2.1, activeHoursAgo: 0.5, response: 0.94, accept: 0.7, looking: true, court: 'c-babson', avail: 8 | 16 | 4, hits: 14 },
  { id: 'p-theo', name: 'Theo', initial: 'K', band: 'minor', level: 8.9, miles: 3.8, activeHoursAgo: 5, response: 0.8, accept: 0.6, looking: true, court: 'c-needham', avail: 8 | 4, hits: 9 },
  { id: 'p-priya', name: 'Priya', initial: 'S', band: 'minor', level: 8.1, miles: 1.4, activeHoursAgo: 20, response: 1.0, accept: 0.9, looking: false, court: 'c-wellesley', avail: 8 | 16 | 32, hits: 22, verified: true },
  { id: 'p-jonah', name: 'Jonah', initial: 'L', band: 'minor', level: 9.4, miles: 6.2, activeHoursAgo: 30, response: 0.55, accept: 0.4, looking: false, court: 'c-newton', avail: 4 | 32, hits: 5 },
  { id: 'p-elena', name: 'Elena', initial: 'M', band: 'minor', level: 7.9, miles: 4.9, activeHoursAgo: 2, response: 0.88, accept: 0.8, looking: true, court: 'c-natick', avail: 1 | 8 | 16, hits: 11 },
  { id: 'p-sam', name: 'Sam', initial: 'D', band: 'minor', level: 8.3, miles: 8.7, activeHoursAgo: 70, response: null, accept: null, looking: false, court: 'c-brookline', avail: 8, hits: 0 },
  { id: 'p-lucas', name: 'Lucas', initial: 'P', band: 'minor', level: 9.8, miles: 5.5, activeHoursAgo: 12, response: 0.7, accept: 0.5, looking: true, court: 'c-longfellow', avail: 2 | 4 | 16, hits: 17 },
  { id: 'p-ava', name: 'Ava', initial: 'C', band: 'minor', level: 7.2, miles: 3.1, activeHoursAgo: 48, response: 0.6, accept: 0.7, looking: false, court: 'c-weston', avail: 8 | 16, hits: 3 },
  { id: 'p-nico', name: 'Nico', initial: 'B', band: 'minor', level: 8.5, miles: 11.3, activeHoursAgo: 1, response: 0.9, accept: 0.85, looking: true, court: 'c-newton', avail: 4 | 8 | 32, hits: 8 },

  { id: 'p-dan', name: 'Dan', initial: 'W', band: 'adult', level: 8.7, miles: 2.8, activeHoursAgo: 3, response: 0.9, accept: 0.7, looking: true, court: 'c-babson', avail: 4 | 8, hits: 31, verified: true },
  { id: 'p-marisol', name: 'Marisol', initial: 'G', band: 'adult', level: 8.2, miles: 5.1, activeHoursAgo: 26, response: 0.75, accept: 0.6, looking: false, court: 'c-newton', avail: 1 | 8 | 16, hits: 12 },
  { id: 'p-kenji', name: 'Kenji', initial: 'O', band: 'adult', level: 9.6, miles: 3.3, activeHoursAgo: 0.2, response: 0.97, accept: 0.8, looking: true, court: 'c-wellesley', avail: 4 | 32, hits: 40 },
  { id: 'p-rachel', name: 'Rachel', initial: 'F', band: 'adult', level: 7.8, miles: 7.4, activeHoursAgo: 9, response: 0.65, accept: 0.5, looking: true, court: 'c-natick', avail: 8 | 16, hits: 6 },
  { id: 'p-omar', name: 'Omar', initial: 'H', band: 'adult', level: 8.9, miles: 12.6, activeHoursAgo: 100, response: 0.4, accept: 0.3, looking: false, court: 'c-brookline', avail: 4, hits: 2 },
  { id: 'p-grace', name: 'Grace', initial: 'T', band: 'adult', level: 8.4, miles: 1.9, activeHoursAgo: 15, response: 0.85, accept: 0.75, looking: true, court: 'c-wellesley', avail: 1 | 2 | 8, hits: 19 },
];

type Row = {
  id: string; fromId: string; toId: string; courtId: string; windowStart: string; windowEnd: string;
  note: string | null; state: HitState; awaitingId: string | null; expiresAt: string; createdAt: string;
  confirmedAt: string | null; declineReason: string | null;
  approvals: Approval[]; confirmations: Record<string, boolean>;
};

type State = {
  session: Session | null;
  profile: null | {
    displayName: string; lastInitial: string; dateOfBirth: string; levelValue: number;
    levelSource: Profile['levelSource']; homeCourtId: string; availabilityMask: number;
    lookingToHitUntil: string | null; lastActiveAt: string;
    guardianEmail: string | null; guardianVerified: boolean;
  };
  requests: Row[];
  messages: Message[];
  blocked: string[];
  cohortOpen: boolean;
  listMode: boolean | null;
  seenConfirmed: string[];
};

const blank = (): State => ({
  session: null, profile: null, requests: [], messages: [], blocked: [],
  cohortOpen: true, listMode: null, seenConfirmed: [],
});

function bucket(mi: number): string {
  if (mi < 1) return 'under 1 mi';
  if (mi < 10) return `~${Math.round(mi)} mi`;
  return `~${Math.round(mi / 5) * 5} mi`;
}

function bandOf(dob: string): 'minor' | 'adult' {
  const d = new Date(dob);
  const eighteen = new Date(d.getFullYear() + 18, d.getMonth(), d.getDate());
  return eighteen <= new Date() ? 'adult' : 'minor';
}

const uid = () => Math.random().toString(36).slice(2, 10);
const iso = (d: Date) => d.toISOString();
const hoursAgo = (h: number) => iso(new Date(Date.now() - h * 3600000));

export class DemoApi implements HitsApi {
  readonly mode = 'demo' as const;
  private s: State = blank();
  private loaded = false;
  private listeners = new Set<() => void>();
  private timers: ReturnType<typeof setTimeout>[] = [];

  // ---- plumbing ----------------------------------------------------------------
  private async load() {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) this.s = { ...blank(), ...JSON.parse(raw) };
    } catch { /* fresh state */ }
    this.loaded = true;
    // Simulated replies are timers; a reload would drop them. Settle anything that has
    // been waiting long enough, and keep settling in the background.
    this.reconcile();
    setInterval(() => { if (this.reconcile()) this.save(); }, 3000);
  }

  private reconcile(): boolean {
    const now = Date.now();
    const age = (iso: string) => now - new Date(iso).getTime();
    let changed = false;
    if (this.s.profile?.guardianEmail && !this.s.profile.guardianVerified && age(this.s.profile.lastActiveAt) > 8000) {
      this.s.profile.guardianVerified = true; changed = true;
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
  async reset() { this.timers.forEach(clearTimeout); this.s = blank(); await AsyncStorage.removeItem(KEY); this.listeners.forEach(l => l()); }

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

  // ---- me ----------------------------------------------------------------------
  private myBand(): 'minor' | 'adult' { return this.s.profile ? bandOf(this.s.profile.dateOfBirth) : 'minor'; }

  private meProfile(): Profile | null {
    const p = this.s.profile; if (!p) return null;
    const mine = this.s.requests.filter(r => r.toId === ME);
    const responded = mine.filter(r => r.state !== 'pending' && r.state !== 'expired');
    const accepted = responded.filter(r => ['accepted', 'confirmed', 'completed'].includes(r.state));
    return {
      id: ME, displayName: p.displayName, lastInitial: p.lastInitial, photoUrl: null,
      band: bandOf(p.dateOfBirth), levelValue: p.levelValue, levelSource: p.levelSource,
      homeCourtId: p.homeCourtId, availabilityMask: p.availabilityMask,
      lastActiveAt: p.lastActiveAt, lookingToHitUntil: p.lookingToHitUntil,
      responseRate: mine.length ? responded.length / mine.length : null,
      acceptRate: responded.length ? accepted.length / responded.length : null,
      hitsConfirmed: this.s.requests.filter(r => r.state === 'completed').length,
      phoneVerified: true,
      guardianVerified: p.guardianVerified,
      guardianPending: !!p.guardianEmail && !p.guardianVerified,
    };
  }
  async me() { await this.load(); return this.meProfile(); }

  async createProfile(input: ProfileInput) {
    await this.load(); await this.wait();
    this.s.profile = {
      ...input, lookingToHitUntil: iso(new Date(Date.now() + 7 * 86400000)),
      lastActiveAt: iso(new Date()), guardianEmail: null, guardianVerified: false,
    };
    // Someone reaches out shortly after you join, so the Requests tab is alive.
    const band = bandOf(input.dateOfBirth);
    const first = SEED.find(x => x.band === band && x.looking)!;
    this.later(6000, () => {
      if (this.s.requests.some(r => r.fromId === first.id)) return;
      const start = nextSlot(first.avail & input.availabilityMask || first.avail, 1);
      this.s.requests.push(row(first.id, ME, first.court, start, 'Saw you just joined — up for a hit?', ME));
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
      marketSlug: 'boston', marketName: 'Boston', band,
      activePlayers: this.s.cohortOpen ? (band === 'minor' ? 231 : 188) : 142,
      minActivePlayers: 200,
      discoveryOpen: this.s.cohortOpen,
    };
  }
  async courts() { await this.load(); return COURTS; }
  async peek(level: number, band: 'minor' | 'adult') {
    await this.wait(250);
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
      responseRate: p.response, acceptRate: p.accept, hitsConfirmed: p.hits,
    };
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
      confirmedAt: r.confirmedAt, declineReason: r.declineReason, other, approvals: r.approvals,
      myConfirmation: r.confirmations[viewer] ?? null,
      theirConfirmation: r.confirmations[otherId] ?? null,
    };
  }
  private selfAsPlayer(): Player {
    const m = this.meProfile()!;
    return {
      id: ME, displayName: m.displayName, lastInitial: m.lastInitial, photoUrl: null,
      levelValue: m.levelValue, levelSource: m.levelSource, levelVerified: m.levelSource === 'utr_verified',
      levelDelta: 0, distanceBucket: null, homeCourtId: m.homeCourtId,
      homeCourtName: COURTS.find(c => c.id === m.homeCourtId)?.name ?? null,
      availabilityMask: m.availabilityMask, lookingToHit: !!m.lookingToHitUntil,
      lastActiveAt: m.lastActiveAt, responseRate: m.responseRate, acceptRate: m.acceptRate, hitsConfirmed: m.hitsConfirmed,
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
      r.approvals.filter(a => a.minorId !== ME).forEach(a => this.later(9000 + Math.random() * 6000, () => {
        a.decision = true; a.decidedAt = iso(new Date());
        this.maybeConfirm(r);
      }));
    }
  }
  private maybeConfirm(r: Row) {
    if (r.state === 'accepted' && r.approvals.every(a => a.decision === true)) { r.state = 'confirmed'; r.confirmedAt = iso(new Date()); }
  }

  async sendRequest(toId: string, courtId: string, start: Date, end: Date, note: string | null) {
    await this.load(); await this.wait();
    if (this.s.blocked.includes(toId)) throw new ApiError("You can't reach this player.");
    const seed = SEED.find(p => p.id === toId);
    if (!seed || seed.band !== this.myBand()) throw new ApiError("You can't reach this player.");
    const r = row(ME, toId, courtId, start, note, toId, end);
    this.s.requests.push(r);
    // They reply. Mostly yes; sometimes a real, non-ghost "no".
    const declines = (seed.accept ?? 0.7) < 0.5 && Math.random() < 0.6;
    this.later(4000 + Math.random() * 4000, () => {
      if (r.state !== 'pending') return;
      if (declines) { r.state = 'declined'; r.declineReason = DECLINE_COPY.not_this_week; r.awaitingId = null; }
      else this.onAccepted(r);
    });
    this.save();
    return this.toRequest(r);
  }
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
    r.courtId = courtId; r.windowStart = iso(start); r.windowEnd = iso(end);
    r.state = 'countered'; r.approvals = [];
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
    const replies = ['sounds good', "i'll bring balls", 'see you there', 'perfect', 'yes — new can of balls on me', 'works for me'];
    this.later(2500 + Math.random() * 2500, () => {
      this.s.messages.push({ id: uid(), hitId: id, senderId: otherId, body: replies[Math.floor(Math.random() * replies.length)], createdAt: iso(new Date()) });
    });
    this.save(); return m;
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

  // ---- safety ------------------------------------------------------------------
  async block(profileId: string) {
    await this.load(); if (!this.s.blocked.includes(profileId)) this.s.blocked.push(profileId);
    this.s.requests.filter(r => r.fromId === profileId || r.toId === profileId).forEach(r => { if (!['completed'].includes(r.state)) r.state = 'cancelled'; });
    this.save();
  }
  async report() { await this.wait(300); }

  // ---- guardian ----------------------------------------------------------------
  async inviteGuardian(email: string) {
    await this.load(); if (!this.s.profile) throw new ApiError('no profile');
    this.s.profile.guardianEmail = email; this.s.profile.guardianVerified = false;
    // In the demo the parent says yes quickly, so the flow can be walked in one sitting.
    this.later(8000, () => { if (this.s.profile) this.s.profile.guardianVerified = true; });
    this.save();
  }
  async guardianChildren(): Promise<GuardianChild[]> {
    await this.load();
    const me = this.meProfile(); if (!me || me.band !== 'minor') return [];
    const rows = this.s.requests.filter(r => r.fromId === ME || r.toId === ME);
    const pending = rows.flatMap(r => r.approvals.filter(a => a.minorId === ME && a.decision == null).map(a => ({ ...a, request: this.toRequest(r) })));
    const upcoming = rows.filter(r => r.state === 'confirmed').map(r => this.toRequest(r));
    return [{ profile: me, pendingApprovals: pending, upcoming }];
  }
  async guardianDecide(hitId: string, minorId: string, decision: boolean) {
    await this.load(); await this.wait();
    const r = this.find(hitId);
    const a = r.approvals.find(x => x.minorId === minorId); if (!a) throw new ApiError('Nothing to approve');
    a.decision = decision; a.decidedAt = iso(new Date());
    if (decision) this.maybeConfirm(r); else { r.state = 'declined'; r.declineReason = 'A parent passed on this one'; }
    this.save(); return a;
  }
  async guardianHit(hitId: string) {
    await this.load();
    const r = this.s.requests.find(x => x.id === hitId); if (!r) return null;
    return { request: this.toRequest(r), messages: this.s.messages.filter(m => m.hitId === hitId), child: this.meProfile()! };
  }
}

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
  };
}
