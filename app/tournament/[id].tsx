// One tournament: when and where, your entry (division, singles or doubles, and whether you
// are still looking for a partner), and the players you could already find who are playing
// it. Partner seekers in your division come first, with a button to ask.
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Field } from '@/ui/Field';
import { Pill } from '@/ui/Pill';
import { Avatar } from '@/ui/Avatar';
import { Score } from '@/ui/Score';
import { Loading } from '@/ui/Loading';
import { useToast } from '@/ui/Toast';
import { hit, radius, space } from '@/theme/tokens';
import { makeStyles } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { haptic } from '@/lib/haptics';
import { entryText, practiceBefore, tournamentDates, whenText } from '@/lib/tournaments';

export default function TournamentPage() {
  const { id, enter } = useLocalSearchParams<{ id: string; enter?: string }>();
  const router = useRouter();
  const toast = useToast();
  const s = useS();
  const { profile, tick } = useSession();
  const all = useAsync(() => api.tournaments(), [tick]);
  const players = useAsync(() => api.tournamentPlayers(id), [id, tick]);
  const tr = all.data?.find(x => x.id === id) ?? null;
  const [editing, setEditing] = useState(!!enter);
  const [division, setDivision] = useState('');
  const [singles, setSingles] = useState(false);
  const [doubles, setDoubles] = useState(true);
  const [wants, setWants] = useState(false);
  const [busy, setBusy] = useState(false);
  const minor = profile?.band === 'minor';
  const canInvite = !!profile && (profile.band === 'adult' || profile.guardianVerified);

  // Start the form from what you entered last time.
  useEffect(() => {
    if (!tr?.entered) return;
    setDivision(tr.division ?? ''); setSingles(tr.singles); setDoubles(tr.doubles); setWants(tr.wantsPartner);
  }, [tr?.entered, tr?.division, tr?.singles, tr?.doubles, tr?.wantsPartner]);

  if (all.loading && !all.data) return <Screen><Centered><Header backLabel="Tournaments" /><Loading /></Centered></Screen>;
  if (!tr) return <Screen><Centered><Header backLabel="Tournaments" /><Card><T v="body" tone="muted">This tournament is over, or not in your area.</T></Card></Centered></Screen>;

  const save = async () => {
    setBusy(true);
    try {
      await api.enterTournament(tr.id, { division: division.trim() || null, singles, doubles, wantsPartner: doubles && wants });
      haptic.tick(); setEditing(false);
      toast(doubles && wants ? "You're in. Players looking for a partner can see you are too." : "You're in.");
      await Promise.all([all.reload(), players.reload()]);
    } catch (e: any) { haptic.warn(); toast(e?.message ?? "That didn't save."); }
    finally { setBusy(false); }
  };
  const leave = async () => {
    try { await api.leaveTournament(tr.id); await all.reload(); setEditing(false); toast("You're off the list for this one."); }
    catch (e: any) { toast(e?.message ?? "That didn't save."); }
  };
  const ask = (pid: string) => {
    const w = practiceBefore(tr);
    router.push({ pathname: '/request/[id]', params: {
      id: pid, doubles: '1', role: 'partner', tournament: tr.id, note: `Partner for ${tr.name}?`.slice(0, 140), ...(w ? w : {}),
    } });
  };

  const list = players.data ?? [];
  const seekers = list.filter(p => p.wantsPartner);
  const rest = list.filter(p => !p.wantsPartner);
  const playerRow = (p: typeof list[number], i: number) => (
    <View key={p.id} style={[s.row, i > 0 && s.rule]}>
      <Tap onPress={() => router.push(`/player/${p.id}`)} style={st.who} accessibilityRole="button"
        accessibilityLabel={`${p.displayName}${p.lastInitial ? ` ${p.lastInitial}.` : ''}, ${p.levelValue != null ? `rating ${p.levelValue.toFixed(1)}` : 'no rating'}${p.age != null ? `, age ${p.age}` : ''}. ${entryText(p)}${p.wantsPartner ? '. Looking for a doubles partner' : ''}. Open profile.`}>
        <Avatar name={p.displayName} lastInitial={p.lastInitial} photo={p.photoUrl} size={42} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={st.line}>
            <T v="smallM" numberOfLines={1} style={{ flexShrink: 1 }}>{p.displayName}{p.lastInitial ? ` ${p.lastInitial}.` : ''}</T>
            <Score value={p.levelValue} source={p.levelSource} verified={p.levelSource === 'utr_verified'} sans align="left" style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }} />
          </View>
          <T v="meta" tone={p.sameDivision ? 'green' : 'muted'} numberOfLines={2}>
            {[p.age != null ? `Age ${p.age}` : null, entryText(p), p.sameDivision ? 'Your division' : null].filter(Boolean).join(' · ')}
          </T>
        </View>
      </Tap>
      {p.doubles && (
        <Button title={p.wantsPartner ? 'Ask to partner' : 'Practise'} small kind={p.wantsPartner ? 'primary' : 'line'} disabled={!canInvite}
          onPress={() => p.wantsPartner ? ask(p.id) : router.push({ pathname: '/request/[id]', params: { id: p.id, note: `Practice before ${tr.name}?`.slice(0, 140), ...(practiceBefore(tr) ?? {}) } })} />
      )}
      {!p.doubles && (
        <Button title="Practise" small kind="line" disabled={!canInvite}
          onPress={() => router.push({ pathname: '/request/[id]', params: { id: p.id, note: `Practice before ${tr.name}?`.slice(0, 140), ...(practiceBefore(tr) ?? {}) } })} />
      )}
    </View>
  );

  return (
    <Screen onRefresh={async () => { await Promise.all([all.reload(), players.reload()]); }}>
      <Centered>
        <Header backLabel="Tournaments" />
        <T v="eyebrow" tone="muted">{whenText(tr)} · {tournamentDates(tr)}</T>
        <T v="display" style={st.h} accessibilityRole="header">{tr.name}</T>
        {(tr.location || tr.url) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap', marginBottom: space.md }}>
            {tr.location && <T v="small" tone="muted" style={{ flexShrink: 1 }}>{tr.location}</T>}
            {tr.url && <Button title="Tournament site" small kind="ghost" icon="arrow-up-right" onPress={() => { Linking.openURL(tr.url!).catch(() => toast("Couldn't open the link.")); }} />}
          </View>
        )}
        <T v="meta" tone="muted" style={{ marginBottom: space.lg, lineHeight: 18 }}>Added by a player on Hits. Check entries and the draw with the organizer.</T>

        <T v="micro" tone="muted" style={st.k}>Your entry</T>
        {!editing && tr.entered ? (
          <Card style={{ gap: space.sm }}>
            <T v="bodyM">You're playing {entryText(tr)}</T>
            {tr.doubles && <T v="small" tone={tr.wantsPartner ? 'green' : 'muted'}>{tr.wantsPartner ? 'Looking for a doubles partner. Players who can see you know.' : 'You have a doubles partner.'}</T>}
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: space.xs }}>
              <Button title="Change" small kind="line" onPress={() => setEditing(true)} />
              <Button title="I'm not playing" small kind="ghost" onPress={leave} />
            </View>
          </Card>
        ) : !editing ? (
          <Card style={{ gap: space.sm }}>
            <T v="small" tone="muted">Playing it? Say so, and the players who can find you on Hits see you are too.</T>
            <Button title="I'm playing" arrow onPress={() => setEditing(true)} />
          </Card>
        ) : (
          <Card style={{ gap: space.md }}>
            <Field label="Division (optional)" value={division} onChangeText={v => setDivision(v.slice(0, 12))} placeholder={minor ? '14U, B16, G18' : '4.0, Open'} autoCapitalize="characters" maxLength={12} />
            <View style={{ gap: space.sm }}>
              <T v="micro" tone="muted">Playing</T>
              <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                <Pill label="Singles" on={singles} onPress={() => setSingles(v => !v)} />
                <Pill label="Doubles" on={doubles} onPress={() => setDoubles(v => !v)} />
              </View>
            </View>
            {doubles && (
              <View style={{ gap: space.sm }}>
                <T v="micro" tone="muted">Doubles partner</T>
                <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                  <Pill label="I have one" on={!wants} onPress={() => setWants(false)} />
                  <Pill label="Still looking" on={wants} onPress={() => setWants(true)} />
                </View>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title={tr.entered ? 'Save' : "I'm playing"} arrow onPress={save} loading={busy} disabled={!singles && !doubles} style={{ flex: 1 }} />
              <Button title="Cancel" kind="ghost" small onPress={() => setEditing(false)} />
            </View>
          </Card>
        )}

        <T v="micro" tone="muted" style={st.k}>Also playing</T>
        {players.loading && !players.data ? <Loading /> : list.length === 0 ? (
          <Card><T v="small" tone="muted">Nobody you could play with has said they're in yet.{minor ? ' You only see players under 18 your parent\'s age rule allows.' : ''}</T></Card>
        ) : (
          <>
            {seekers.length > 0 && <T v="smallM" style={{ marginBottom: space.sm }}>Looking for a doubles partner</T>}
            {seekers.length > 0 && <Card style={st.list}>{seekers.map(playerRow)}</Card>}
            {rest.length > 0 && seekers.length > 0 && <T v="smallM" style={{ marginTop: space.lg, marginBottom: space.sm }}>Everyone else you know of</T>}
            {rest.length > 0 && <Card style={st.list}>{rest.map(playerRow)}</Card>}
          </>
        )}
        <T v="meta" tone="muted" style={{ marginTop: space.md, lineHeight: 18 }}>
          {minor ? 'Only players under 18 who could already find you on Hits are listed, and a parent still approves every hit.' : 'Only adults who could already find you on Hits are listed.'}
        </T>
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  h: { marginTop: 12, marginBottom: 10 },
  k: { marginTop: 18, marginBottom: 10 },
  list: { paddingVertical: 2, paddingHorizontal: 0 },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: hit.min },
  line: { flexDirection: 'row', alignItems: 'baseline', columnGap: 8, flexWrap: 'wrap' },
});
const useS = makeStyles(c => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.lg },
  rule: { borderTopWidth: 1, borderTopColor: c.line },
}));
