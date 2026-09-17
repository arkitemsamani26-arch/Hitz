// Supabase implementation against the schema in supabase/migrations.
//
// The `app` schema must be exposed in the project's API settings (Settings -> API ->
// Exposed schemas) for these calls to resolve. Row visibility is enforced by RLS; this
// file never tries to re-implement a safety rule, it just asks.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, type HitsApi } from './api';
import type {
  Approval, Court, DeclineReason, DiscoverFilters, GuardianChild, HitRequest, HitState,
  MarketStatus, Message, Player, Profile, ProfileInput, Session,
} from './types';
import { DECLINE_COPY } from './types';

const MI = 1609.34;

export class SupabaseApi implements HitsApi {
  readonly mode = 'supabase' as const;
  private sb: SupabaseClient<any, 'app', any>;
  private uid: string | null = null;
  private listeners = new Set<() => void>();

  constructor(url: string, anonKey: string) {
    this.sb = createClient<any, 'app', any>(url, anonKey, {
      db: { schema: 'app' },
      auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }

  onChange(cb: () => void) {
    this.listeners.add(cb);
    const ch = this.sb.channel('hits-changes')
      .on('postgres_changes', { event: '*', schema: 'app', table: 'hit_requests' }, () => cb())
      .on('postgres_changes', { event: '*', schema: 'app', table: 'hit_messages' }, () => cb())
      .on('postgres_changes', { event: '*', schema: 'app', table: 'hit_guardian_approvals' }, () => cb())
      .subscribe();
    return () => { this.listeners.delete(cb); void this.sb.removeChannel(ch); };
  }

  private fail(e: { message: string } | null, fallback = 'Something went wrong'): never {
    throw new ApiError(e?.message ?? fallback);
  }

  // ---- auth --------------------------------------------------------------------
  async restore(): Promise<Session | null> {
    const { data } = await this.sb.auth.getSession();
    const u = data.session?.user; if (!u) return null;
    this.uid = u.id;
    const isGuardian = (await this.sb.from('guardian_links').select('id').eq('guardian_user_id', u.id).not('verified_at', 'is', null).limit(1)).data?.length ? true : false;
    const hasProfile = (await this.sb.from('profiles').select('id').eq('id', u.id).maybeSingle()).data != null;
    return { userId: u.id, phone: u.phone ?? '', isGuardian: isGuardian && !hasProfile };
  }
  async sendCode(phone: string) {
    const { error } = await this.sb.auth.signInWithOtp({ phone });
    if (error) this.fail(error);
  }
  async verifyCode(phone: string, code: string): Promise<Session> {
    const { data, error } = await this.sb.auth.verifyOtp({ phone, token: code, type: 'sms' });
    if (error || !data.user) this.fail(error, "That's not it.");
    this.uid = data.user.id;
    return (await this.restore())!;
  }
  async signOut() { await this.sb.auth.signOut(); this.uid = null; }

  // ---- me ----------------------------------------------------------------------
  private mapProfile(r: any, extras: { guardianVerified: boolean; guardianPending: boolean }): Profile {
    return {
      id: r.id, displayName: r.display_name, lastInitial: r.last_initial, photoUrl: r.photo_url,
      band: new Date(r.adult_at) <= new Date() ? 'adult' : 'minor',
      levelValue: r.level_value == null ? null : Number(r.level_value), levelSource: r.level_source,
      homeCourtId: r.home_court_id, availabilityMask: r.availability_mask,
      lastActiveAt: r.last_active_at, lookingToHitUntil: r.looking_to_hit_until,
      responseRate: r.requests_received ? r.requests_responded / r.requests_received : null,
      acceptRate: r.requests_responded ? r.requests_accepted / r.requests_responded : null,
      hitsConfirmed: r.hits_confirmed, phoneVerified: !!r.phone_verified_at, ...extras,
    };
  }
  async me() {
    if (!this.uid) return null;
    const { data } = await this.sb.from('profiles').select('*').eq('id', this.uid).maybeSingle();
    if (!data) return null;
    const links = (await this.sb.from('guardian_links').select('verified_at, revoked_at').eq('minor_profile_id', this.uid).is('revoked_at', null)).data ?? [];
    return this.mapProfile(data, { guardianVerified: links.some(l => l.verified_at), guardianPending: links.length > 0 && !links.some(l => l.verified_at) });
  }
  async createProfile(input: ProfileInput) {
    if (!this.uid) throw new ApiError('not signed in');
    const market = (await this.sb.from('markets').select('id').eq('slug', 'boston').single()).data;
    const { error } = await this.sb.from('profiles').insert({
      id: this.uid, market_id: market?.id, display_name: input.displayName, last_initial: input.lastInitial,
      date_of_birth: input.dateOfBirth, level_value: input.levelValue, level_source: input.levelSource,
      home_court_id: input.homeCourtId, availability_mask: input.availabilityMask,
      looking_to_hit_until: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    if (error) this.fail(error);
    // Phone is verified by the OTP sign-in; stamp it server-side.
    await this.sb.rpc('stamp_phone_verified').then(() => {}, () => {});
    return (await this.me())!;
  }
  async updateProfile(patch: Partial<Profile>) {
    const row: any = {};
    if (patch.availabilityMask != null) row.availability_mask = patch.availabilityMask;
    if (patch.homeCourtId != null) row.home_court_id = patch.homeCourtId;
    if (patch.displayName != null) row.display_name = patch.displayName;
    if (patch.levelValue != null) row.level_value = patch.levelValue;
    if (patch.levelSource != null) row.level_source = patch.levelSource;
    const { error } = await this.sb.from('profiles').update(row).eq('id', this.uid!);
    if (error) this.fail(error);
    return (await this.me())!;
  }
  async setLooking(days: number | null) {
    const { error } = await this.sb.from('profiles').update({ looking_to_hit_until: days ? new Date(Date.now() + days * 86400000).toISOString() : null }).eq('id', this.uid!);
    if (error) this.fail(error);
    return (await this.me())!;
  }
  async setLocation(lat: number, lon: number) { await this.sb.rpc('set_my_location', { p_lat: lat, p_lon: lon }); }
  async touch() { await this.sb.rpc('touch_me'); }

  // ---- market ------------------------------------------------------------------
  async marketStatus(): Promise<MarketStatus | null> {
    const { data } = await this.sb.rpc('my_market_status');
    const r = data?.[0]; if (!r) return null;
    return { marketSlug: r.market_slug, marketName: r.market_slug === 'boston' ? 'Boston' : r.market_slug, band: r.age_band, activePlayers: Number(r.active_players), minActivePlayers: r.min_active_players, discoveryOpen: r.discovery_open };
  }
  async courts(): Promise<Court[]> {
    const { data } = await this.sb.from('courts').select('id, name, access, indoor, surface').eq('is_active', true).order('name');
    return (data ?? []).map(c => ({ id: c.id, name: c.name, access: c.access, indoor: c.indoor, surface: c.surface, distanceBucket: null }));
  }
  async peek() {
    // Before a profile exists RLS returns nothing, and that is correct. Show the cohort
    // count instead: it is the honest number.
    const s = await this.marketStatus();
    return { count: s?.activePlayers ?? 0, sample: [] };
  }

  // ---- discovery ---------------------------------------------------------------
  private mapPlayer(r: any, courts: Map<string, string>): Player {
    return {
      id: r.profile_id ?? r.id, displayName: r.display_name, lastInitial: r.last_initial, photoUrl: r.photo_url,
      levelValue: r.level_value == null ? null : Number(r.level_value), levelSource: r.level_source,
      levelVerified: r.level_source === 'utr_verified',
      levelDelta: r.level_delta == null ? null : Number(r.level_delta), distanceBucket: r.distance_bucket ?? null,
      homeCourtId: r.home_court_id, homeCourtName: courts.get(r.home_court_id) ?? null,
      availabilityMask: r.availability_mask, lookingToHit: !!r.looking_to_hit || (r.looking_to_hit_until && new Date(r.looking_to_hit_until) > new Date()),
      lastActiveAt: r.last_active_at,
      responseRate: r.response_rate != null ? Number(r.response_rate) : (r.requests_received ? r.requests_responded / r.requests_received : null),
      acceptRate: r.accept_rate != null ? Number(r.accept_rate) : (r.requests_responded ? r.requests_accepted / r.requests_responded : null),
      hitsConfirmed: r.hits_confirmed,
    };
  }
  private async courtMap() { return new Map((await this.courts()).map(c => [c.id, c.name])); }
  async discover(f: DiscoverFilters) {
    const { data, error } = await this.sb.rpc('discover', {
      p_radius_m: Math.round(f.radiusMi * MI), p_level_lo: f.levelLo, p_level_hi: f.levelHi,
      p_availability: f.availability, p_only_looking: f.onlyLooking,
    });
    if (error) this.fail(error);
    const courts = await this.courtMap();
    return (data ?? []).map((r: any) => this.mapPlayer(r, courts));
  }
  async player(id: string) {
    const { data } = await this.sb.from('profiles').select('*').eq('id', id).maybeSingle();
    if (!data) return null;
    return this.mapPlayer(data, await this.courtMap());
  }

  // ---- hits --------------------------------------------------------------------
  private async mapRequest(r: any, viewer: string): Promise<HitRequest> {
    const otherId = r.from_profile_id === viewer ? r.to_profile_id : r.from_profile_id;
    const other = (await this.player(otherId)) ?? ({ id: otherId, displayName: 'Player', lastInitial: null } as Player);
    const approvals = (r.hit_guardian_approvals ?? []).map((a: any): Approval => ({
      hitId: r.id, minorId: a.minor_profile_id, minorName: '', guardianUserId: a.guardian_user_id, decision: a.decision, decidedAt: a.decided_at,
    }));
    const confs: any[] = r.hit_confirmations ?? [];
    return {
      id: r.id, fromId: r.from_profile_id, toId: r.to_profile_id, courtId: r.court_id,
      courtName: r.courts?.name ?? 'Court', windowStart: r.window_start, windowEnd: r.window_end, note: r.note,
      state: r.state as HitState, awaitingId: r.awaiting_profile_id, expiresAt: r.expires_at, createdAt: r.created_at,
      confirmedAt: r.confirmed_at, declineReason: r.decline_reason ?? null, other, approvals,
      myConfirmation: confs.find(c => c.profile_id === viewer)?.did_play ?? null,
      theirConfirmation: confs.find(c => c.profile_id === otherId)?.did_play ?? null,
    };
  }
  private sel = '*, courts(name), hit_guardian_approvals(*), hit_confirmations(*)';
  async requests() {
    const { data } = await this.sb.from('hit_requests').select(this.sel).order('created_at', { ascending: false });
    return Promise.all((data ?? []).map(r => this.mapRequest(r, this.uid!)));
  }
  async hit(id: string) {
    const { data } = await this.sb.from('hit_requests').select(this.sel).eq('id', id).maybeSingle();
    if (!data) return null;
    const msgs = (await this.sb.from('hit_messages').select('*').eq('hit_request_id', id).order('created_at')).data ?? [];
    return { request: await this.mapRequest(data, this.uid!), messages: msgs.map(m => ({ id: m.id, hitId: id, senderId: m.sender_profile_id, body: m.body, createdAt: m.created_at })) };
  }
  async sendRequest(toId: string, courtId: string, start: Date, end: Date, note: string | null) {
    const market = (await this.sb.from('profiles').select('market_id').eq('id', this.uid!).single()).data;
    const { data, error } = await this.sb.from('hit_requests').insert({
      market_id: market?.market_id, from_profile_id: this.uid, to_profile_id: toId, court_id: courtId,
      window_start: start.toISOString(), window_end: end.toISOString(), note, awaiting_profile_id: toId,
    }).select(this.sel).single();
    if (error) this.fail(error, "You can't reach this player.");
    return this.mapRequest(data, this.uid!);
  }
  async cancelRequest(id: string) { await this.sb.from('hit_requests').update({ state: 'cancelled', awaiting_profile_id: null }).eq('id', id); }
  async accept(id: string) {
    const { error } = await this.sb.from('hit_requests').update({ state: 'accepted', awaiting_profile_id: null }).eq('id', id);
    if (error) this.fail(error);
    return (await this.hit(id))!.request;
  }
  async decline(id: string, reason: DeclineReason) {
    const { error } = await this.sb.from('hit_requests').update({ state: 'declined', awaiting_profile_id: null, note: DECLINE_COPY[reason] }).eq('id', id);
    if (error) this.fail(error);
    return (await this.hit(id))!.request;
  }
  async counter(id: string, courtId: string, start: Date, end: Date) {
    const cur = (await this.hit(id))!.request;
    const { error } = await this.sb.from('hit_requests').update({
      court_id: courtId, window_start: start.toISOString(), window_end: end.toISOString(), state: 'countered',
      awaiting_profile_id: cur.fromId === this.uid ? cur.toId : cur.fromId,
    }).eq('id', id);
    if (error) this.fail(error);
    await this.sb.from('hit_request_revisions').insert({ hit_request_id: id, by_profile_id: this.uid, court_id: courtId, window_start: start.toISOString(), window_end: end.toISOString() });
    return (await this.hit(id))!.request;
  }
  async sendMessage(id: string, body: string) {
    const { data, error } = await this.sb.from('hit_messages').insert({ hit_request_id: id, sender_profile_id: this.uid, body }).select().single();
    if (error) this.fail(error);
    return { id: data.id, hitId: id, senderId: data.sender_profile_id, body: data.body, createdAt: data.created_at };
  }
  async confirmPlayed(id: string, didPlay: boolean) {
    const { error } = await this.sb.from('hit_confirmations').insert({ hit_request_id: id, profile_id: this.uid, did_play: didPlay });
    if (error) this.fail(error);
    return (await this.hit(id))!.request;
  }

  // ---- safety ------------------------------------------------------------------
  async block(profileId: string) { const { error } = await this.sb.from('blocks').insert({ blocker_id: this.uid, blocked_id: profileId }); if (error) this.fail(error); }
  async report(profileId: string, reason: string, body: string, hitId?: string) {
    const { error } = await this.sb.from('reports').insert({ reporter_profile_id: this.uid, reported_profile_id: profileId, reason, body, hit_request_id: hitId ?? null });
    if (error) this.fail(error);
  }

  // ---- guardian ----------------------------------------------------------------
  async inviteGuardian(email: string, phone: string) {
    const { error } = await this.sb.from('guardian_links').insert({ minor_profile_id: this.uid, guardian_email: email, guardian_phone: phone, relationship: 'parent' });
    if (error) this.fail(error);
  }
  async guardianChildren(): Promise<GuardianChild[]> {
    const links = (await this.sb.from('guardian_links').select('minor_profile_id').eq('guardian_user_id', this.uid!).not('verified_at', 'is', null).is('revoked_at', null)).data ?? [];
    const out: GuardianChild[] = [];
    for (const l of links) {
      const p = (await this.sb.from('profiles').select('*').eq('id', l.minor_profile_id).maybeSingle()).data;
      if (!p) continue;
      const profile = this.mapProfile(p, { guardianVerified: true, guardianPending: false });
      const rows = (await this.sb.from('hit_requests').select(this.sel).or(`from_profile_id.eq.${p.id},to_profile_id.eq.${p.id}`)).data ?? [];
      const reqs = await Promise.all(rows.map(r => this.mapRequest(r, p.id)));
      const pendingApprovals = reqs.flatMap(r => r.approvals.filter(a => a.minorId === p.id && a.decision == null).map(a => ({ ...a, minorName: profile.displayName, request: r })));
      out.push({ profile, pendingApprovals, upcoming: reqs.filter(r => r.state === 'confirmed') });
    }
    return out;
  }
  async guardianDecide(hitId: string, minorId: string, decision: boolean) {
    const { data, error } = await this.sb.from('hit_guardian_approvals').update({ decision }).eq('hit_request_id', hitId).eq('minor_profile_id', minorId).select().single();
    if (error) this.fail(error);
    return { hitId, minorId, minorName: '', guardianUserId: data.guardian_user_id, decision: data.decision, decidedAt: data.decided_at };
  }
  async guardianHit(hitId: string) {
    const { data: raw } = await this.sb.from('hit_requests').select(this.sel).eq('id', hitId).maybeSingle();
    const data: any = raw;
    if (!data) return null;
    const kids = await this.guardianChildren();
    const child = kids.find(k => k.profile.id === data.from_profile_id || k.profile.id === data.to_profile_id)?.profile;
    if (!child) return null;
    const msgs = (await this.sb.from('hit_messages').select('*').eq('hit_request_id', hitId).order('created_at')).data ?? [];
    return { request: await this.mapRequest(data, child.id), messages: msgs.map(m => ({ id: m.id, hitId, senderId: m.sender_profile_id, body: m.body, createdAt: m.created_at })), child };
  }
}
