// Discover. The wordmark, the hero, your next window, and the player we would hand you.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card, GUTTER } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Loading } from '@/ui/Loading';
import { Countdown } from '@/ui/Countdown';
import { FeaturedCard, CompactRow } from '@/ui/Player';
import { Icon } from '@/ui/Icon';
import { DiscoverHeader, Hero, WindowPanel, SectionHead } from '@/ui/DiscoverParts';
import { WindowEditor } from '@/ui/WindowEditor';
import { Avatar, initialsOf } from '@/ui/Avatar';
import { Score } from '@/ui/Score';
import { Icon as Glyph, type IconName } from '@/ui/Icon';
import { PairingCard } from '@/ui/PairingCard';
import { useToast } from '@/ui/Toast';
import { radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useFilters, activeFilterCount } from '@/store/filters';
import { useNextWindow, useWindow } from '@/store/window';
import { useAsync } from '@/store/useAsync';
import { bestMatch } from '@/lib/defaults';
import { registerPush } from '@/lib/push';
import { hitShort } from '@/lib/format';
import { daysUntil, whenText } from '@/lib/tournaments';
import { haptic } from '@/lib/haptics';

const RADII = [5, 10, 15, 25];

export default function Discover() {
  const router = useRouter();
  const toast = useToast();
  const t = useTheme();
  const s = useS();
  const { profile, setProfile, tick } = useSession();
  const { filters, set } = useFilters();
  const { setWin } = useWindow();
  const win = useNextWindow(profile?.availabilityMask ?? 0);
  const [editing, setEditing] = useState(false);
  const market = useAsync(() => api.marketStatus(), [tick]);
  const players = useAsync(() => api.discover(filters), [filters, tick]);
  const reqs = useAsync(() => api.requests(), [tick]);
  const pairings = useAsync(() => api.myPairings(), [tick]);
  const courtList = useAsync(() => api.courts(), []);
  const tourneys = useAsync(() => api.tournaments(), [tick]);
  // Plus: an auto-match in progress, or one that just finished.
  const autoMatch = useAsync(() => api.myAutoMatch(), [tick]);
  // A tournament you said you are playing, starting within the week (or on now).
  const playing = useMemo(() => (tourneys.data ?? []).find(x => x.entered && daysUntil(x) <= 7) ?? null, [tourneys.data]);
  useEffect(() => { void api.touch(); void registerPush(); }, []);

  const me = profile?.id;
  const canInvite = !!profile && (profile.band === 'adult' || profile.guardianVerified);
  const list = players.data ?? [];
  const waiting = (reqs.data ?? []).filter(r => (r.state === 'pending' || r.state === 'countered') && r.awaitingId === me);
  // Anyone you already have something open with: an invitation either way, or a hit on
  // the calendar. They are not who we suggest next, and their row says why.
  const openWith = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of reqs.data ?? []) {
      if (new Date(r.windowEnd) < new Date()) continue;
      if (r.state === 'confirmed') m.set(r.other.id, 'Hit on the calendar');
      else if (r.state === 'accepted') m.set(r.other.id, 'Waiting on a parent');
      else if ((r.state === 'pending' || r.state === 'countered') && !m.has(r.other.id)) m.set(r.other.id, r.awaitingId === me ? 'Invited you' : 'Invite sent');
    }
    return m;
  }, [reqs.data, me]);
  // Someone a coach just paired you with is already on screen above, so not featured twice.
  const paired = useMemo(() => new Set((pairings.data ?? []).map(x => x.other.id)), [pairings.data]);
  const top = useMemo(() => (profile ? bestMatch(profile, list.filter(p => !openWith.has(p.id) && !paired.has(p.id))) : null), [profile, list, openWith, paired]);
  const rest = useMemo(() => list.filter(p => p.id !== top?.id), [list, top]);
  const my = profile?.levelValue;
  const level = filters.levelLo != null && filters.levelHi != null
    ? `UTR ${filters.levelLo.toFixed(1)}–${filters.levelHi.toFixed(1)}`
    : my != null ? `Around UTR ${my.toFixed(1)}` : 'Any level';
  // A junior sees who is around their age first; say so, so the list never looks short
  // for no reason.
  // The narrower of the junior's own filter and their parent's rule is what the server applies.
  const gap = profile?.band === 'minor' ? [filters.ageGap, profile.maxPartnerAgeGap].filter((x): x is number => x != null).reduce<number | null>((m, x) => (m == null ? x : Math.min(m, x)), null) : null;
  const ages = profile?.band === 'minor' && profile.age != null && gap != null
    ? `ages ${Math.max(10, profile.age - gap)}–${Math.min(17, profile.age + gap)}` : null;
  const range = ages ? `${level.replace('Around ', '')} · ${ages}` : level;

  // One tap that actually finds people: drop whatever is narrowing the list and step the
  // radius out, then say exactly what changed so nothing is loosened behind your back.
  const widen = useCallback(() => {
    const changed: string[] = [];
    const next = { ...filters };
    const r = RADII.find(x => x > filters.radiusMi);
    if (r) { next.radiusMi = r; changed.push(`${r} miles`); }
    if (filters.levelLo != null || filters.levelHi != null) { next.levelLo = null; next.levelHi = null; changed.push('any level'); }
    if (filters.availability) { next.availability = 0; changed.push('any time'); }
    if (filters.onlyLooking) { next.onlyLooking = false; changed.push('not just people looking this week'); }
    if (filters.ageGap != null) { next.ageGap = null; changed.push('any age under 18'); }
    if (!changed.length) { router.push('/filters'); return; }
    set(next);
    toast(`Now showing ${changed.join(', ')}.`);
  }, [filters, set, toast, router]);

  const open = (id: string) => router.push(`/player/${id}`);
  const invite = (id: string) => router.push(`/request/${id}`);
  // Your next confirmed hit, so the first screen answers "what have I got coming up".
  const next = useMemo(() => (reqs.data ?? []).filter(r => r.state === 'confirmed' && new Date(r.windowEnd) > new Date())
    .sort((a, b) => a.windowStart.localeCompare(b.windowStart))[0] ?? null, [reqs.data]);
  // People who said they want to hit this week, beyond the one we feature.
  const keen = useMemo(() => list.filter(p => p.lookingToHit && p.id !== top?.id && !openWith.has(p.id)).slice(0, 10), [list, top, openWith]);
  const looking = !!profile?.lookingToHitUntil && new Date(profile.lookingToHitUntil) > new Date();
  const toggleLooking = async () => {
    try { const p = await api.setLooking(looking ? null : 7); setProfile(p); haptic.tick(); toast(looking ? "You're off the looking list." : "You're on the looking list for 7 days."); }
    catch (e: any) { toast(e?.message ?? "That didn't save."); }
  };
  const ACTIONS: { icon: IconName; label: string; a11y: string; onPress: () => void; on?: boolean }[] = [
    { icon: 'search', label: 'Search', a11y: 'Search players and courts', onPress: () => router.push('/search') },
    { icon: 'map', label: 'Courts', a11y: 'Courts near you', onPress: () => router.push('/(tabs)/courts') },
    { icon: 'zap', label: looking ? "I'm free" : 'Free?', a11y: looking ? 'You are looking to hit this week. Turn it off.' : 'Say you are looking to hit this week', onPress: toggleLooking, on: looking },
    { icon: 'users-round', label: 'Doubles', a11y: 'Players looking for doubles', onPress: () => router.push({ pathname: '/looking', params: { format: 'doubles' } }) },
    { icon: 'trophy', label: 'Events', a11y: 'Tournaments players near you are playing', onPress: () => router.push('/tournaments') },
  ];

  return (
    <Screen flush pad={false} onRefresh={async () => { await Promise.all([players.reload(), reqs.reload(), market.reload(), api.touch().catch(() => {})]); }}>
      <Centered>
        <DiscoverHeader initials={profile ? initialsOf(profile.displayName, profile.lastInitial) : '·'} area={market.data?.marketName ?? 'Palo Alto'} onAccount={() => router.push('/(tabs)/you')} />
        <Hero />
        <View style={st.body}>
          {/* Your next window, floating up over the hero's bottom edge. */}
          <WindowPanel win={win} editing={editing} onEdit={() => setEditing(e => !e)} />
          {editing && (
            <View style={{ marginTop: -10, marginBottom: 21 }}>
              <WindowEditor value={win} onChange={setWin} onDone={() => setEditing(false)} />
            </View>
          )}

          {/* Shortcuts to the things people come here to do. */}
          <View style={st.actions}>
            {ACTIONS.map(a => (
              <Tap key={a.label} onPress={a.onPress} style={[s.action, a.on && s.actionOn]} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={a.a11y} accessibilityState={a.on === undefined ? undefined : { selected: a.on }}>
                <View style={[s.actionIcon, a.on && s.actionIconOn]}><Glyph name={a.icon} size={19} color={a.on ? t.greenText : t.ink} /></View>
                <T v="meta" style={{ fontSize: 11.5 }} numberOfLines={1}>{a.label}</T>
              </Tap>
            ))}
          </View>

          {/* A coach's suggestions come first: someone you trust picked this person for you. */}
          {(pairings.data ?? []).map(x => (
            <PairingCard key={x.id} x={x} courts={courtList.data} locked={!canInvite}
              onOpen={() => open(x.other.id)}
              onDismiss={async () => { try { await api.dismissPairing(x.id); await pairings.reload(); toast(`Coach ${x.coachName.split(' ')[0]} will see you passed on this one.`); } catch (e: any) { toast(e?.message ?? "That didn't go through."); } }}
              onSend={() => router.push({ pathname: '/request/[id]', params: {
                id: x.other.id, pairing: x.id, ...(x.courtId ? { court: x.courtId } : {}),
                ...(x.windowStart && x.windowEnd ? { start: x.windowStart, end: x.windowEnd } : {}),
                note: `Coach ${x.coachName.split(' ')[0]} paired us.${x.note ? ` ${x.note}` : ''}`.slice(0, 140),
              } })} />
          ))}

          {autoMatch.data && (autoMatch.data.state === 'active' || autoMatch.data.state === 'done') && (() => {
            const a = autoMatch.data;
            const hitOf = (reqs.data ?? []).find(r => r.id === (a.currentRequestId ?? a.matchedRequestId)) ?? null;
            const label = a.state === 'active' ? `Hits is finding you a partner for ${hitShort(a.windowStart)}` : `Matched for ${hitShort(a.windowStart)}${hitOf ? ` with ${hitOf.other.displayName}` : ''}`;
            const sub = a.state === 'active' ? `${a.tried === 1 ? 'Asked one player' : `Asked ${a.tried} players`}${hitOf ? ` · waiting on ${hitOf.other.displayName}` : ''}` : 'Auto-match found someone who said yes.';
            return (
              <Tap onPress={() => router.push(a.state === 'done' && hitOf ? `/hit/${hitOf.id}` : '/automatch')} style={s.next} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={`${label}. ${sub}. Open.`}>
                <View style={[s.actionIcon, s.actionIconOn]}><Glyph name="zap" size={19} color={t.greenText} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="micro" tone="muted" style={{ fontSize: 10 }}>Auto-match · Plus</T>
                  <T v="smallM" numberOfLines={2} style={{ marginTop: 2 }}>{label}</T>
                  <T v="meta" tone="muted" numberOfLines={1}>{sub}</T>
                </View>
                <Glyph name="chevron-right" size={15} color={t.muted} />
              </Tap>
            );
          })()}

          {playing && (
            <Tap onPress={() => router.push(`/tournament/${playing.id}`)} style={s.next} scaleTo={0.99} accessibilityRole="button"
              accessibilityLabel={`You're playing ${playing.name}, ${whenText(playing).toLowerCase()}. ${playing.players} player${playing.players === 1 ? '' : 's'} you know of${playing.partnerSeekers ? `, ${playing.partnerSeekers} looking for a doubles partner` : ''}. Open.`}>
              <View style={[s.actionIcon, s.actionIconOn]}><Glyph name="trophy" size={19} color={t.greenText} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="micro" tone="muted" style={{ fontSize: 10 }}>{daysUntil(playing) <= 0 ? 'Playing now' : daysUntil(playing) <= 2 ? 'Playing this weekend' : `Playing ${whenText(playing).toLowerCase()}`}</T>
                <T v="smallM" numberOfLines={1} style={{ marginTop: 2 }}>{playing.name}</T>
                <T v="meta" tone="muted" numberOfLines={1}>{playing.players} player{playing.players === 1 ? '' : 's'} you know of{playing.partnerSeekers ? ` · ${playing.partnerSeekers} want${playing.partnerSeekers === 1 ? 's' : ''} a partner` : ''}</T>
              </View>
              <Glyph name="chevron-right" size={15} color={t.muted} />
            </Tap>
          )}

          {next && (
            <View style={s.next}>
              <Tap onPress={() => router.push(`/hit/${next.id}`)} style={st.nextMain} scaleTo={0.99} accessibilityRole="button"
                accessibilityLabel={`Your next hit: ${hitShort(next.windowStart)} with ${next.other.displayName} at ${next.courtName}. Open.`}>
                <Avatar name={next.other.displayName} lastInitial={next.other.lastInitial} photo={next.other.photoUrl} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="micro" tone="muted" style={{ fontSize: 10 }}>Your next hit</T>
                  <T v="smallM" numberOfLines={1} style={{ marginTop: 2 }}>{hitShort(next.windowStart)} with {next.other.displayName}</T>
                  <T v="meta" tone="muted" numberOfLines={1}>{next.courtName}</T>
                </View>
              </Tap>
              <Tap onPress={() => router.push(`/chat/${next.id}`)} style={st.nextMsg} accessibilityRole="button" accessibilityLabel={`Message ${next.other.displayName}`}>
                <Glyph name="message-circle" size={18} color={t.ink} />
              </Tap>
            </View>
          )}

          {profile?.band === 'minor' && !profile.guardianVerified && (
            <View style={s.note}>
              <Icon name="shield" size={14} color={t.ink} />
              <T v="small" style={{ flex: 1 }}>{profile.guardianOpenedAt ? 'Your parent opened the link. Inviting unlocks when they say yes.' : profile.guardianSentAt ? 'Sent to your parent. Inviting unlocks when they say yes.' : 'No parent linked yet. Browse away; inviting unlocks once they say yes.'}</T>
            </View>
          )}
          {waiting.length > 0 && (
            <Tap onPress={() => router.push('/(tabs)/hits')} style={s.note} accessibilityRole="button" accessibilityLabel={`${waiting.length === 1 ? `${waiting[0].other.displayName} is waiting on your reply` : `${waiting.length} invitations are waiting on you`}. Open My hits.`}>
              <Icon name="clock-3" size={14} color={t.ink} />
              <T v="small" style={{ flex: 1 }}>{waiting.length === 1 ? `${waiting[0].other.displayName} ${waiting[0].other.lastInitial ? waiting[0].other.lastInitial + '. ' : ''}is waiting on your reply` : `${waiting.length} invitations are waiting on you`}</T>
              <Icon name="chevron-right" size={15} color={t.muted} />
            </Tap>
          )}

          <SectionHead title="Your kind of player." right={range} onRight={() => router.push('/filters')} rightLabel={`${range}. Change filters.`} />

          {market.data && !market.data.discoveryOpen ? (
            <Countdown m={market.data} onInvite={() => router.push('/(tabs)/you')} />
          ) : players.loading && !players.data ? (
            <Loading label="Finding players near your level" />
          ) : players.error ? (
            <Card style={{ gap: space.sm }}>
              <T v="bodyM">Couldn't load players.</T>
              <T v="small" tone="muted">{players.error}</T>
              <Button title="Try again" kind="line" small onPress={() => players.reload()} style={{ alignSelf: 'flex-start' }} />
            </Card>
          ) : !profile ? null : list.length === 0 ? (
            <Card style={{ gap: space.sm }}>
              <T v="h2">No one matches yet.</T>
              <T v="body" tone="muted">{activeFilterCount(filters) || filters.ageGap != null ? `Your filters: ${[`${filters.radiusMi} mi`, filters.levelLo != null ? 'a narrow level band' : null, filters.availability ? 'set times' : null, filters.onlyLooking ? 'looking this week only' : null, filters.ageGap != null ? 'players around your age' : null].filter(Boolean).join(', ')}. Widen them and more players show up.` : 'Nobody near your level within this radius yet. Try a few more miles.'}</T>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: space.xs }}>
                <Button title="Widen the search" small onPress={widen} />
                <Button title="Filters" kind="line" small onPress={() => router.push('/filters')} />
              </View>
            </Card>
          ) : (
            <>
              {top && <FeaturedCard p={top} me={profile} win={win} onInvite={() => invite(top.id)} onOpen={() => open(top.id)} locked={!canInvite} lockedLabel="Unlocks when your parent says yes" />}
              {keen.length > 1 && (
                <>
                  <View style={st.rowHead}>
                    <T v="h2" accessibilityRole="header">Free this week.</T>
                    <Tap onPress={() => router.push('/looking')} style={{ minHeight: 44, justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={`See all ${keen.length} looking this week, with when they are free`}>
                      <T v="smallM" tone="green">See all {keen.length}</T>
                    </Tap>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.carousel}>
                    {keen.map(p => (
                      <Tap key={p.id} onPress={() => open(p.id)} style={s.keen} scaleTo={0.97} accessibilityRole="button"
                        accessibilityLabel={`${p.displayName}${p.lastInitial ? ` ${p.lastInitial}.` : ''}, ${p.levelValue != null ? `rating ${p.levelValue.toFixed(1)}` : 'no rating'}${p.age != null ? `, age ${p.age}` : ''}. Looking to hit this week. Open profile.`}>
                        <Avatar name={p.displayName} lastInitial={p.lastInitial} photo={p.photoUrl} size={56} dot />
                        <T v="smallM" numberOfLines={1} style={{ marginTop: 8 }}>{p.displayName}{p.lastInitial ? ` ${p.lastInitial}.` : ''}</T>
                        <T v="meta" tone="muted" numberOfLines={1}>{p.age != null ? `Age ${p.age} · ` : ''}{p.homeCourtName ?? p.distanceBucket ?? ''}</T>
                        <Score value={p.levelValue} source={p.levelSource} verified={p.levelVerified} sans align="left" style={{ marginTop: 6 }} />
                      </Tap>
                    ))}
                  </ScrollView>
                  <T v="h2" style={{ marginTop: 6, marginBottom: 2 }} accessibilityRole="header">Everyone nearby.</T>
                </>
              )}
              <View style={{ paddingTop: 4 }}>
                {rest.map((p, i) => <CompactRow key={p.id} p={p} first={i === 0} note={openWith.get(p.id)} onPress={() => { const r = (reqs.data ?? []).find(x => x.other.id === p.id && new Date(x.windowEnd) > new Date() && ['pending', 'countered', 'accepted', 'confirmed'].includes(x.state)); if (r) router.push(`/hit/${r.id}`); else open(p.id); }} />)}
              </View>
              {rest.length > 0 && <T v="meta" tone="muted" style={{ marginTop: space.md }}>{list.length} players within {filters.radiusMi} miles. Tap a name to invite.</T>}
            </>
          )}
        </View>
      </Centered>
    </Screen>
  );
}

const st = StyleSheet.create({
  body: { paddingHorizontal: GUTTER, paddingBottom: GUTTER },
  actions: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  nextMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  nextMsg: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 26, marginBottom: 10 },
  carousel: { gap: 10, paddingBottom: 6, paddingRight: 4 },
});
const useS = makeStyles(c => ({
  action: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6, paddingVertical: 11, paddingHorizontal: 1, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, minHeight: 76 },
  actionOn: { borderColor: c.green },
  actionIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
  actionIconOn: { backgroundColor: c.green },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingRight: 4, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, marginBottom: 18 },
  keen: { width: 132, padding: 13, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  note: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: c.soft, borderRadius: radius.xs, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 21, minHeight: 44 },
}));
