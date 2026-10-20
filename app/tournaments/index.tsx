// Tournaments players near you said they are playing. Add the one you are in, say which
// division and events, and see who else you could already find is playing it -- a doubles
// partner, or someone to practise with the night before.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Field } from '@/ui/Field';
import { Pill } from '@/ui/Pill';
import { Icon } from '@/ui/Icon';
import { Loading } from '@/ui/Loading';
import { useToast } from '@/ui/Toast';
import { hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { haptic } from '@/lib/haptics';
import { day, entryText, tournamentDates, whenText, ymd } from '@/lib/tournaments';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Tournaments() {
  const router = useRouter();
  const toast = useToast();
  const t = useTheme();
  const s = useS();
  const { profile, tick } = useSession();
  const list = useAsync(() => api.tournaments(), [tick]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [days, setDays] = useState(2);
  const [where, setWhere] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const minor = profile?.band === 'minor';

  // The next five weeks of days, weekends first in each week, to tap rather than type.
  const choices = useMemo(() => Array.from({ length: 35 }, (_, i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);
  const mine = (list.data ?? []).filter(x => x.entered);
  const others = (list.data ?? []).filter(x => !x.entered);

  const add = async () => {
    if (!first || busy) return;
    setBusy(true);
    try {
      const end = day(first); end.setDate(end.getDate() + days - 1);
      const id = await api.addTournament(name.trim(), first, ymd(end), where.trim() || null, link.trim() || null);
      haptic.tick();
      setAdding(false); setName(''); setFirst(null); setWhere(''); setLink('');
      await list.reload();
      router.push({ pathname: '/tournament/[id]', params: { id, enter: '1' } });
    } catch (e: any) { haptic.warn(); toast(e?.message ?? "Couldn't add it."); }
    finally { setBusy(false); }
  };

  const row = (x: NonNullable<typeof list.data>[number], i: number) => (
    <Tap key={x.id} onPress={() => router.push(`/tournament/${x.id}`)} style={[s.row, i > 0 && s.rule]} scaleTo={0.99} accessibilityRole="button"
      accessibilityLabel={`${x.name}, ${tournamentDates(x)}${x.location ? `, ${x.location}` : ''}. ${x.entered ? `You're playing ${entryText(x)}. ` : ''}${x.players} player${x.players === 1 ? '' : 's'} you could play with${x.partnerSeekers ? `, ${x.partnerSeekers} looking for a doubles partner` : ''}. Open.`}>
      <View style={[s.date, x.entered && s.dateOn]}>
        <T v="micro" tone={x.entered ? 'greenText' : 'ink'} style={{ fontSize: 9 }}>{DAY_NAMES[day(x.startsOn).getDay()]}</T>
        <T v="h2" tone={x.entered ? 'greenText' : 'ink'} style={{ lineHeight: 24 }}>{day(x.startsOn).getDate()}</T>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="smallM" numberOfLines={2}>{x.name}</T>
        <T v="meta" tone="muted" numberOfLines={1}>{[whenText(x), tournamentDates(x), x.location].filter(Boolean).join(' · ')}</T>
        <T v="meta" tone={x.entered ? 'green' : 'muted'} numberOfLines={1} style={{ marginTop: 2 }}>
          {x.entered ? `You're playing ${entryText(x)}` : `${x.players} player${x.players === 1 ? '' : 's'} you know of`}{x.partnerSeekers ? ` · ${x.partnerSeekers} want${x.partnerSeekers === 1 ? 's' : ''} a partner` : ''}
        </T>
      </View>
      <Icon name="chevron-right" size={15} color={t.muted} />
    </Tap>
  );

  return (
    <Screen onRefresh={() => list.reload()}>
      <Centered>
        <Header backLabel="Back" />
        <T v="eyebrow" tone="muted">Tournaments</T>
        <T v="display" style={st.h} accessibilityRole="header">Playing a{'\n'}<T v="display" italic>tournament?</T></T>
        <T v="small" tone="muted" style={{ marginBottom: space.lg, lineHeight: 21 }}>
          Say which one, and see who else is playing it: a doubles partner, or someone to practise with before.
          {minor ? ' Only players under 18 your parent\'s age rule allows can see that you are playing. Adults never see it.' : ' Only players over 18 see your entry.'}
        </T>

        {list.loading && !list.data ? <Loading label="Finding tournaments" /> : list.error ? (
          <Card style={{ gap: space.sm }}><T v="small" tone="muted">{list.error}</T><Button title="Try again" small kind="line" onPress={() => list.reload()} style={{ alignSelf: 'flex-start' }} /></Card>
        ) : (
          <>
            {mine.length > 0 && (
              <>
                <T v="micro" tone="muted" style={st.k}>You're playing</T>
                <Card style={st.list}>{mine.map(row)}</Card>
              </>
            )}
            <T v="micro" tone="muted" style={st.k}>{mine.length ? 'Also coming up' : 'Coming up near you'}</T>
            {others.length ? <Card style={st.list}>{others.map(row)}</Card> : (
              <Card><T v="small" tone="muted">{mine.length ? 'Nothing else added yet.' : 'Nobody has added a tournament yet. Add yours and it shows here for players near you.'}</T></Card>
            )}
          </>
        )}

        {!adding ? (
          <Button title="Add a tournament" kind="line" icon="plus" onPress={() => setAdding(true)} style={{ marginTop: space.lg }} />
        ) : (
          <Card style={{ marginTop: space.lg, gap: space.md }}>
            <T v="h2">Add a tournament</T>
            <Field label="Name" value={name} onChangeText={setName} placeholder="Its name, as on the entry site" maxLength={80} autoCapitalize="words" />
            <View style={{ gap: space.sm }}>
              <T v="micro" tone="muted">First day</T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                {choices.map(d => {
                  const v = ymd(d);
                  return <Pill key={v} label={`${DAY_NAMES[d.getDay()]} ${d.getDate()}`} on={first === v} onPress={() => setFirst(v)} />;
                })}
              </ScrollView>
            </View>
            <View style={{ gap: space.sm }}>
              <T v="micro" tone="muted">How many days</T>
              <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                {[1, 2, 3, 4].map(n => <Pill key={n} label={n === 1 ? 'One day' : `${n} days`} on={days === n} onPress={() => setDays(n)} />)}
              </View>
            </View>
            <Field label="Where (optional)" value={where} onChangeText={setWhere} placeholder="Club or park, and town" maxLength={120} />
            <Field label="Link (optional)" value={link} onChangeText={setLink} placeholder="https://" autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={300} />
            <T v="meta" tone="muted" style={{ lineHeight: 18 }}>Added by players, not by the tournament. Hits doesn't know the draw; check it with the organizer.</T>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title="Add it" arrow onPress={add} loading={busy} disabled={name.trim().length < 3 || !first} style={{ flex: 1 }} />
              <Button title="Cancel" kind="ghost" small onPress={() => setAdding(false)} />
            </View>
          </Card>
        )}
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  h: { marginTop: 12, marginBottom: 12 },
  k: { marginTop: 18, marginBottom: 10 },
  list: { paddingVertical: 2, paddingHorizontal: 0 },
});
const useS = makeStyles(c => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: hit.row },
  rule: { borderTopWidth: 1, borderTopColor: c.line },
  date: { width: 46, height: 50, borderRadius: radius.md, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
  dateOn: { backgroundColor: c.green },
}));
