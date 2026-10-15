// Pair two players. Pick them (the second list ranks who fits the first), then either set a
// time and court or leave the time to them, add a note, and send it to both.
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Field } from '@/ui/Field';
import { Pill } from '@/ui/Pill';
import { Icon } from '@/ui/Icon';
import { Avatar } from '@/ui/Avatar';
import { Loading } from '@/ui/Loading';
import { OptionSheet } from '@/ui/Sheet';
import { WindowEditor } from '@/ui/WindowEditor';
import { useToast } from '@/ui/Toast';
import { hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useAsync } from '@/store/useAsync';
import { defaultWindow, type Window } from '@/store/window';
import { endOf } from '@/lib/match';
import { dateLong, rangeText } from '@/lib/format';
import { midpointCourt } from '@/lib/courts';
import { pairReasons, suggestPairs } from '@/lib/coach';
import { haptic } from '@/lib/haptics';
import type { RosterMember } from '@/data/types';

export default function PairPlayers() {
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const router = useRouter();
  const toast = useToast();
  const t = useTheme();
  const s = useS();
  const roster = useAsync(() => api.coachRoster(), []);
  const courts = useAsync(() => api.courts(), []);
  const [aId, setA] = useState<string | null>(params.a ?? null);
  const [bId, setB] = useState<string | null>(params.b ?? null);
  const [picking, setPicking] = useState<null | 'a' | 'b' | 'court'>(null);
  const [theirTime, setTheirTime] = useState(false);
  const [win, setWin] = useState<Window | null>(null);
  const [courtId, setCourtId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const active = useMemo(() => (roster.data ?? []).filter(m => m.status === 'active'), [roster.data]);
  const a = active.find(m => m.id === aId) ?? null;
  const b = active.find(m => m.id === bId) ?? null;
  // The second list: who fits the first, best first. Only the same side of 18.
  const fits = useMemo(() => {
    if (!a) return active;
    const ranked = suggestPairs(active.filter(m => m.id === a.id || m.band === a.band), new Set()).filter(([x, y]) => x.id === a.id || y.id === a.id).map(([x, y]) => (x.id === a.id ? y : x));
    const rest = active.filter(m => m.id !== a.id && m.band === a.band && !ranked.some(r => r.id === m.id));
    return [...ranked, ...rest];
  }, [active, a]);
  const when: Window = win ?? defaultWindow((a?.availabilityMask ?? 0) & (b?.availabilityMask ?? 0) || (a?.availabilityMask ?? 0));
  const middle = a && b && courts.data ? midpointCourt(a.homeCourtId, b.homeCourtId, courts.data.map(c => c.id)) : null;
  const chosenCourt = courtId ?? middle ?? a?.homeCourtId ?? null;
  const court = courts.data?.find(c => c.id === chosenCourt) ?? null;

  const send = async () => {
    if (!a || !b || busy) return;
    setBusy(true);
    try {
      await api.coachPair(a.id, b.id, chosenCourt, theirTime ? null : when.start, theirTime ? null : endOf(when), note.trim() || null);
      haptic.sent();
      toast(`Sent to ${a.displayName} and ${b.displayName}. You'll see when one of them invites the other.`);
      router.back();
    } catch (e: any) { haptic.warn(); toast(e?.message ?? "Couldn't pair them."); setBusy(false); }
  };

  if (roster.loading && !roster.data) return <Screen><Centered><Header backLabel="Coach tools" /><Loading /></Centered></Screen>;

  const slot = (m: RosterMember | null, which: 'a' | 'b', label: string) => (
    <Tap onPress={() => setPicking(which)} style={s.slot} accessibilityRole="button" accessibilityLabel={m ? `${label}: ${m.displayName}. Change.` : `Choose the ${label.toLowerCase()}`}>
      {m ? <Avatar name={m.displayName} lastInitial={m.lastInitial} photo={m.photoUrl} size={48} /> : <View style={s.empty}><Icon name="plus" size={20} color={t.muted} /></View>}
      <T v="smallM" numberOfLines={1} style={{ marginTop: 8 }}>{m ? `${m.displayName}${m.lastInitial ? ` ${m.lastInitial}.` : ''}` : label}</T>
      <T v="meta" tone="muted" numberOfLines={1}>{m ? [m.levelValue != null ? m.levelValue.toFixed(1) : null, m.age != null ? `age ${m.age}` : null].filter(Boolean).join(' · ') || ' ' : 'Tap to choose'}</T>
    </Tap>
  );

  return (
    <Screen bottom={<Centered><Button title={a && b ? `Send to ${a.displayName} and ${b.displayName}` : 'Choose two players'} arrow onPress={send} loading={busy} disabled={!a || !b} /></Centered>}>
      <Centered>
        <Header backLabel="Coach tools" />
        <T v="eyebrow" tone="muted">A pairing</T>
        <T v="display" style={st.h} accessibilityRole="header">Who should{'\n'}<T v="display" italic>hit together?</T></T>

        <View style={st.pair}>
          {slot(a, 'a', 'First player')}
          <View style={s.plus}><Icon name="handshake" size={18} color={t.ink} /></View>
          {slot(b, 'b', 'Second player')}
        </View>
        {a && b && <T v="meta" tone="muted" style={{ textAlign: 'center', marginTop: space.sm }}>{pairReasons(a, b).join(' · ')}</T>}

        <T v="micro" tone="muted" style={st.k}>When</T>
        <View style={st.chips}>
          <Pill label="Suggest a time" on={!theirTime} onPress={() => setTheirTime(false)} />
          <Pill label="Let them pick" on={theirTime} onPress={() => setTheirTime(true)} />
        </View>
        {!theirTime && (
          <Card style={{ marginTop: space.sm, gap: space.sm }}>
            <T v="bodyM">{dateLong(when.start)}, {rangeText(when.start, endOf(when))}</T>
            <WindowEditor value={when} onChange={setWin} />
          </Card>
        )}

        <T v="micro" tone="muted" style={st.k}>Where</T>
        <Tap onPress={() => setPicking('court')} style={s.court} accessibilityRole="button" accessibilityLabel={`Court: ${court?.name ?? 'none'}. Change.`}>
          <Icon name="map-pin" size={17} color={t.ink} />
          <View style={{ flex: 1 }}>
            <T v="smallM">{court?.name ?? 'Pick a court'}</T>
            <T v="meta" tone="muted">{court && court.id === middle && court.id !== a?.homeCourtId && court.id !== b?.homeCourtId ? 'About halfway between their home courts' : 'Court access and booking not checked'}</T>
          </View>
          <Icon name="chevron-right" size={15} color={t.muted} />
        </Tap>

        <View style={{ marginTop: space.lg }}>
          <Field label="A note to both (optional)" value={note} onChangeText={setNote} placeholder="Work on returns. Play a tiebreak at the end." maxLength={280} multiline accessibilityLabel="A note to both players" />
        </View>
        <T v="meta" tone="muted" style={{ marginTop: space.sm, lineHeight: 18 }}>
          Both get your suggestion. Either can send the invite; from there it is their hit{a?.band === 'minor' ? ', and their parents approve it' : ''}.
        </T>

        <OptionSheet open={picking === 'a' || picking === 'b'} onClose={() => setPicking(null)} title={picking === 'b' && a ? `Who fits ${a.displayName}?` : 'Choose a player'}
          options={(picking === 'b' ? fits.filter(m => m.id !== a?.id) : active.filter(m => m.id !== bId)).map(m => ({
            label: `${m.displayName}${m.lastInitial ? ` ${m.lastInitial}.` : ''}`,
            sub: picking === 'b' && a ? pairReasons(a, m).join(' · ') : [m.levelValue != null ? `${m.levelValue.toFixed(1)}` : null, m.age != null ? `age ${m.age}` : null].filter(Boolean).join(' · '),
            onPress: () => { if (picking === 'a') { setA(m.id); if (b && b.band !== m.band) setB(null); } else setB(m.id); setWin(null); },
          }))} />
        <OptionSheet open={picking === 'court'} onClose={() => setPicking(null)} title="Where"
          options={(courts.data ?? []).map(c => ({ label: c.name, sub: [c.id === middle ? 'Halfway between them' : null, c.access === 'club' ? 'Club' : 'Public'].filter(Boolean).join(' · '), onPress: () => setCourtId(c.id) }))} />
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  h: { marginTop: 12, marginBottom: 18 },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  k: { marginTop: 24, marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
});
const useS = makeStyles(c => ({
  slot: { flex: 1, minWidth: 0, alignItems: 'center', padding: 14, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, minHeight: 120 },
  empty: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.muted, alignItems: 'center', justifyContent: 'center' },
  plus: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
  court: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, minHeight: hit.row },
}));
