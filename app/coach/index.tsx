// Coach tools. Turn them on with an academy name; then your join code, your players, pairs
// we would suggest, and every pairing you have made with how it went.
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Field } from '@/ui/Field';
import { Pill } from '@/ui/Pill';
import { Icon } from '@/ui/Icon';
import { Avatar } from '@/ui/Avatar';
import { Score } from '@/ui/Score';
import { Loading } from '@/ui/Loading';
import { Court as CourtArt } from '@/ui/CourtArt';
import { useToast } from '@/ui/Toast';
import { fixed, font, hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { shareText } from '@/lib/share';
import { hitShort } from '@/lib/format';
import { suggestPairs, pairReasons, pairingStatus } from '@/lib/coach';
import { slotsSummary, type RosterMember } from '@/data/types';

export default function CoachTools() {
  const router = useRouter();
  const toast = useToast();
  const t = useTheme();
  const s = useS();
  const { profile, tick } = useSession();
  const coaching = useAsync(() => api.myCoaching(), [tick]);
  const roster = useAsync(() => (coaching.data ? api.coachRoster() : Promise.resolve([] as RosterMember[])), [coaching.data, tick]);
  const pairs = useAsync(() => (coaching.data ? api.coachPairings() : Promise.resolve([])), [coaching.data, tick]);
  const courts = useAsync(() => api.courts(), []);
  const [academy, setAcademy] = useState('');
  const [busy, setBusy] = useState(false);

  const active = useMemo(() => (roster.data ?? []).filter(m => m.status === 'active'), [roster.data]);
  const waiting = useMemo(() => (roster.data ?? []).filter(m => m.status !== 'active'), [roster.data]);
  const open = useMemo(() => new Set((pairs.data ?? []).filter(x => x.state === 'open').map(x => [x.aId, x.bId].sort().join('|'))), [pairs.data]);
  const ideas = useMemo(() => suggestPairs(active, open).slice(0, 4), [active, open]);
  const played = (pairs.data ?? []).filter(x => x.hitState === 'confirmed' || x.hitState === 'completed').length;

  if (coaching.loading && coaching.data === undefined) return <Screen><Centered><Header /><Loading /></Centered></Screen>;

  // Not a coach yet --------------------------------------------------------------------------
  if (!coaching.data) {
    const adult = profile?.band === 'adult';
    const turnOn = async () => {
      setBusy(true);
      try { await api.becomeCoach(academy.trim()); await coaching.reload(); toast('Coach tools are on. Share your code with your players.'); }
      catch (e: any) { toast(e?.message ?? "That didn't go through."); }
      finally { setBusy(false); }
    };
    return (
      <Screen bottom={adult ? <Centered><Button title="Turn on coach tools" arrow onPress={turnOn} loading={busy} disabled={academy.trim().length < 2} /></Centered> : undefined}>
        <Centered>
          <Header backLabel="Profile" />
          <T v="eyebrow" tone="muted">Coach tools</T>
          <T v="display" style={st.h} accessibilityRole="header">Pair your{'\n'}<T v="display" italic>players up.</T></T>
          <T v="small" tone="muted" style={st.sub}>Run an academy, a team or a group of students? Your players join with your code, and you pair them to hit with each other between lessons. They get your suggestion, send each other the invite, and you can see how it went.</T>
          {adult ? (
            <>
              <Field label="Your academy or team" value={academy} onChangeText={setAcademy} placeholder="Peninsula Tennis Academy" maxLength={60} autoCapitalize="words" />
              <Card style={{ gap: space.sm, marginTop: space.lg }}>
                <T v="smallM">Coaching juniors</T>
                <T v="small" tone="muted">Under-18s appear on your roster only after their parent approves you and a person at Hits confirms who you are. You can suggest partners; you can't message them, and their parents still approve every hit.</T>
              </Card>
            </>
          ) : (
            <Card><T v="small" tone="muted">Coach tools are for adults. If your coach uses Hits, join them from your profile with their code.</T></Card>
          )}
        </Centered>
      </Screen>
    );
  }

  // The dashboard --------------------------------------------------------------------------
  const c = coaching.data;
  const share = async () => {
    const how = await shareText(`Join ${c.academy} on Hits so I can pair you with players to hit with. In Hits, go to Profile, then "Join your coach", and enter ${c.code}.`);
    if (how === 'copied') toast('Copied. Send it to your players.');
    else if (how === 'failed') toast(`Your code is ${c.code}.`);
  };
  return (
    <Screen onRefresh={async () => { await Promise.all([roster.reload(), pairs.reload()]); }}>
      <Centered>
        <Header backLabel="Profile" />
        <T v="eyebrow" tone="muted">Coach tools</T>
        <T v="display" style={st.h} accessibilityRole="header">{c.academy}</T>

        <View style={s.code}>
          <View style={st.codeArt} pointerEvents="none"><CourtArt width={110} height={190} color={fixed.art} /></View>
          <T v="micro" tone="memberMeta" style={{ fontSize: 10, letterSpacing: 1.6 }}>Players join with</T>
          <T v="display" tone="memberText" style={{ marginTop: 6, letterSpacing: 2, fontSize: 34, lineHeight: 38 }} selectable>{c.code}</T>
          <View style={st.codeStats}>
            {[[String(active.length), active.length === 1 ? 'Player' : 'Players'], [String(waiting.length), 'Waiting'], [String((pairs.data ?? []).length), 'Pairings'], [String(played), 'Hits on']].map(([v, l]) => (
              <View key={l} style={{ flex: 1 }}>
                <T v="rating" tone="memberText" style={{ fontSize: 24, lineHeight: 28 }}>{v}</T>
                <T v="micro" tone="memberMeta" style={{ fontSize: 9, letterSpacing: 1 }} numberOfLines={1}>{l}</T>
              </View>
            ))}
          </View>
          <Tap onPress={share} style={s.shareBtn} accessibilityRole="button" accessibilityLabel={`Share your join code ${c.code}`}>
            <Icon name="share" size={16} color={fixed.member} />
            <T v="smallM" style={{ color: fixed.member }}>Share the code</T>
          </Tap>
        </View>

        {!c.juniorsVerified && (
          <View style={s.notice}>
            <Icon name="shield" size={15} color={t.ink} />
            <T v="small" style={{ flex: 1 }}>Juniors appear once their parent approves you and Hits has confirmed who you are. We check every coach of under-18s by hand.</T>
          </View>
        )}

        {ideas.length > 0 && (
          <>
            <T v="micro" tone="muted" style={st.k}>Pairs we would suggest</T>
            <Card style={{ paddingVertical: 2, paddingHorizontal: 0 }}>
              {ideas.map(([a, b], i) => (
                <View key={a.id + b.id} style={[s.row, i > 0 && s.rule]}>
                  <View style={st.faces}>
                    <Avatar name={a.displayName} lastInitial={a.lastInitial} photo={a.photoUrl} size={36} />
                    <Avatar name={b.displayName} lastInitial={b.lastInitial} photo={b.photoUrl} size={36} ring style={{ marginLeft: -10 }} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T v="smallM" numberOfLines={1}>{a.displayName} and {b.displayName}</T>
                    <T v="meta" tone="muted" numberOfLines={2}>{pairReasons(a, b).join(' · ')}</T>
                  </View>
                  <Button title="Pair" small onPress={() => router.push({ pathname: '/coach/pair', params: { a: a.id, b: b.id } })} />
                </View>
              ))}
            </Card>
          </>
        )}

        <View style={st.kRow}>
          <T v="micro" tone="muted">Your players</T>
          {active.length >= 2 && <Tap onPress={() => router.push('/coach/pair')} style={st.kAction} accessibilityRole="button"><T v="smallM" tone="green">Pair two players</T></Tap>}
        </View>
        {roster.loading && !roster.data ? <Loading /> : (roster.data ?? []).length === 0 ? (
          <Card style={{ gap: space.sm }}>
            <T v="smallM">No one has joined yet.</T>
            <T v="small" tone="muted">Send your players the code. They join from their Profile, under "Join your coach".</T>
            <Button title="Share the code" kind="line" small icon="share" onPress={share} style={{ alignSelf: 'flex-start' }} />
          </Card>
        ) : (
          <Card style={{ paddingVertical: 2, paddingHorizontal: 0 }}>
            {(roster.data ?? []).map((m, i) => {
              const ok = m.status === 'active';
              return (
                <Tap key={m.id} onPress={ok ? () => router.push({ pathname: '/coach/pair', params: { a: m.id } }) : undefined} disabled={!ok} style={[s.row, i > 0 && s.rule]}
                  accessibilityRole={ok ? 'button' : undefined}
                  accessibilityLabel={ok ? `${m.displayName}${m.lastInitial ? ` ${m.lastInitial}.` : ''}, ${m.levelValue != null ? `rating ${m.levelValue.toFixed(1)}` : 'no rating'}${m.age != null ? `, age ${m.age}` : ''}. Pair them with someone.` : `${m.displayName}. ${m.status === 'parent' ? 'Waiting on their parent' : 'Waiting on Hits to confirm you'}.`}>
                  <Avatar name={m.displayName} lastInitial={m.lastInitial} photo={m.photoUrl} size={40} dot={m.lookingToHit} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T v="smallM" numberOfLines={1}>{m.displayName}{m.lastInitial ? ` ${m.lastInitial}.` : ''}</T>
                    <T v="meta" tone="muted" numberOfLines={1}>
                      {ok ? [m.age != null ? `Age ${m.age}` : null, m.availabilityMask ? slotsSummary(m.availabilityMask) : null].filter(Boolean).join(' · ') || 'Joined'
                        : m.status === 'parent' ? 'Waiting on their parent' : 'Waiting on Hits to confirm you'}
                    </T>
                  </View>
                  {ok ? <Score value={m.levelValue} source={m.levelSource} verified={m.levelVerified} sans /> : <Pill label="Not yet" icon="clock-3" />}
                </Tap>
              );
            })}
          </Card>
        )}

        {(pairs.data ?? []).length > 0 && (
          <>
            <T v="micro" tone="muted" style={st.k}>Your pairings</T>
            <Card style={{ paddingVertical: 2, paddingHorizontal: 0 }}>
              {(pairs.data ?? []).slice(0, 12).map((x, i) => {
                const stt = pairingStatus(x);
                const court = courts.data?.find(cc => cc.id === x.courtId)?.name;
                return (
                  <View key={x.id} style={[s.row, i > 0 && s.rule]} accessible accessibilityLabel={`${x.aName} and ${x.bName}. ${stt.label}.`}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="smallM" numberOfLines={1}>{x.aName} and {x.bName}</T>
                      <T v="meta" tone="muted" numberOfLines={1}>{[x.windowStart ? hitShort(x.windowStart) : 'Their pick of time', court].filter(Boolean).join(' · ')}</T>
                    </View>
                    <Pill label={stt.label} icon={stt.icon} tone={stt.good ? 'green' : 'line'} />
                  </View>
                );
              })}
            </Card>
            <T v="meta" tone="muted" style={{ marginTop: space.sm, lineHeight: 18 }}>You see where each pairing stands, never what the players say to each other.</T>
          </>
        )}
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  h: { marginTop: 12, marginBottom: 14 },
  sub: { marginBottom: 22, lineHeight: 21 },
  k: { marginTop: 26, marginBottom: 10 },
  kRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 4 },
  kAction: { minHeight: hit.min, justifyContent: 'center' },
  codeArt: { position: 'absolute', right: -14, top: -14, opacity: 0.6 },
  codeStats: { flexDirection: 'row', gap: 8, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: fixed.memberRule },
  faces: { flexDirection: 'row', alignItems: 'center' },
});
const useS = makeStyles(c => ({
  code: { backgroundColor: fixed.member, borderRadius: 16, padding: 20, overflow: 'hidden', borderWidth: 1, borderColor: fixed.memberLine },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, minHeight: hit.min, borderRadius: radius.md, backgroundColor: fixed.memberText },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: c.soft, borderRadius: radius.xs, padding: 12, marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 15, minHeight: hit.row },
  rule: { borderTopWidth: 1, borderTopColor: c.line },
}));
