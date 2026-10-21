// Your stats, Plus. Hits per month for the last year, who you play most, and your level
// over time. Drawn with plain views: a bar is a view with a height.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Avatar } from '@/ui/Avatar';
import { Loading } from '@/ui/Loading';
import { hit, radius, space } from '@/theme/tokens';
import { makeStyles } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { isPlusError, plainMessage } from '@/lib/plus';
import { levelBig } from '@/lib/format';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function StatsScreen() {
  const router = useRouter();
  const s = useS();
  const { profile, tick } = useSession();
  const stats = useAsync(() => api.myStats(), [tick]);
  const plus = !!profile?.plus;

  if (!plus || (stats.error && isPlusError(stats.error))) {
    return (
      <Screen>
        <Centered>
          <Header backLabel="Profile" fallback="/(tabs)/you" />
          <T v="eyebrow" tone="muted">Your stats · Plus</T>
          <T v="display" style={st.h} accessibilityRole="header">Your year{'\n'}<T v="display" italic>on court.</T></T>
          <Card style={{ gap: space.sm }}>
            <T v="smallM">Part of Plus</T>
            <T v="small" tone="muted">Hits per month, who you play most and your level over time. $4.99 a month, with auto-match, unlimited invitations and every filter.</T>
            <Button title={profile?.band === 'minor' ? 'Ask your parent for Plus' : 'See Plus'} arrow onPress={() => router.push('/plus?why=stats')} />
          </Card>
        </Centered>
      </Screen>
    );
  }
  const d = stats.data;
  const max = Math.max(1, ...(d?.months ?? []).map(m => m.hits));
  const levels = d?.levels ?? [];
  const lo = Math.min(...levels.map(l => l.level), profile?.levelValue ?? 16), hi = Math.max(...levels.map(l => l.level), profile?.levelValue ?? 1);
  const span = Math.max(0.5, hi - lo);
  const month = (ym: string) => { const [y, m] = ym.split('-').map(Number); return { i: m - 1, y }; };

  return (
    <Screen onRefresh={() => stats.reload()}>
      <Centered>
        <Header backLabel="Profile" fallback="/(tabs)/you" />
        <T v="eyebrow" tone="muted">Your stats · Plus</T>
        <T v="display" style={st.h} accessibilityRole="header">Your year{'\n'}<T v="display" italic>on court.</T></T>

        {stats.loading && !d ? <Loading label="Adding it up" /> : stats.error ? (
          <Card style={{ gap: space.sm }}><T v="small" tone="muted">{plainMessage(stats.error)}</T><Button title="Try again" small kind="line" onPress={() => stats.reload()} style={{ alignSelf: 'flex-start' }} /></Card>
        ) : d && (
          <>
            <View style={st.tiles}>
              {[{ v: d.total, l: d.total === 1 ? 'Hit played' : 'Hits played' }, { v: d.invited, l: 'Invitations sent' }, { v: d.received, l: 'Received' }].map(x => (
                <Card key={x.l} style={st.tile}><T v="rating">{x.v}</T><T v="micro" tone="muted" style={{ marginTop: 2 }}>{x.l}</T></Card>
              ))}
            </View>

            <T v="micro" tone="muted" style={st.k}>Hits per month</T>
            <Card>
              <View style={st.bars} accessible accessibilityLabel={`Hits per month: ${d.months.map(m => `${MONTHS_LONG[month(m.month).i]} ${m.hits}`).join(', ')}.`}>
                {d.months.map(m => (
                  <View key={m.month} style={st.barCol}>
                    <View style={st.barTrack}><View style={[s.bar, { height: `${Math.max(4, (m.hits / max) * 100)}%` }, m.hits === 0 && s.barEmpty]} /></View>
                    <T v="meta" tone="muted" style={{ fontSize: 10 }}>{MONTHS[month(m.month).i]}</T>
                  </View>
                ))}
              </View>
              <T v="meta" tone="muted" style={{ marginTop: space.sm }}>{d.months.slice(-1)[0]?.hits ?? 0} this month{max > 1 ? ` · best month ${max}` : ''}.</T>
            </Card>

            <T v="micro" tone="muted" style={st.k}>Who you play most</T>
            {d.partners.length === 0 ? <Card><T v="small" tone="muted">Nobody yet. Your first hit starts the count.</T></Card> : (
              <Card style={{ paddingVertical: 2 }}>
                {d.partners.map((p, i) => (
                  <Tap key={p.id} onPress={() => router.push(`/player/${p.id}`)} style={[st.row, i > 0 && s.rule]} accessibilityRole="button" accessibilityLabel={`${p.name}${p.initial ? ` ${p.initial}.` : ''}, ${p.hits} ${p.hits === 1 ? 'hit' : 'hits'} together. Open profile.`}>
                    <Avatar name={p.name} lastInitial={p.initial} photo={p.photo} size={40} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="smallM" numberOfLines={1}>{p.name}{p.initial ? ` ${p.initial}.` : ''}</T>
                      <T v="meta" tone="muted">{p.hits} {p.hits === 1 ? 'hit' : 'hits'} together</T>
                    </View>
                    <Button title="Rematch" small kind="line" onPress={() => router.push(`/request/${p.id}`)} />
                  </Tap>
                ))}
              </Card>
            )}

            <T v="micro" tone="muted" style={st.k}>Your level</T>
            <Card>
              <View style={st.line} accessible accessibilityLabel={`Your level over time: ${levels.map(l => levelBig(l.level)).join(', ')}. Now ${levelBig(profile?.levelValue ?? null)}.`}>
                {levels.length < 2 ? <T v="small" tone="muted">{levelBig(profile?.levelValue ?? null)} now. The line draws itself as your rating changes.</T>
                  : levels.map((l, i) => (
                    <View key={i} style={st.pt}>
                      <View style={{ flex: 1, justifyContent: 'flex-end' }}><View style={[s.dot, { marginBottom: `${((l.level - lo) / span) * 80}%` }]} /></View>
                    </View>
                  ))}
              </View>
              {levels.length >= 2 && <T v="meta" tone="muted" style={{ marginTop: space.sm }}>From {levelBig(levels[0].level)} to {levelBig(levels[levels.length - 1].level)}{profile?.levelSource === 'utr_verified' ? ', verified by UTR' : ', as you reported it'}.</T>}
            </Card>
          </>
        )}
        <View style={{ height: space.lg }} />
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  h: { marginTop: 12, marginBottom: 16 },
  k: { marginTop: 22, marginBottom: 10 },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, minWidth: 0, paddingVertical: 14, paddingHorizontal: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 110 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: hit.row, paddingVertical: 10 },
  line: { flexDirection: 'row', alignItems: 'stretch', gap: 2, minHeight: 70 },
  pt: { flex: 1, alignItems: 'center' },
});
const useS = makeStyles(c => ({
  bar: { width: '100%', borderRadius: 3, backgroundColor: c.green },
  barEmpty: { backgroundColor: c.line },
  rule: { borderTopWidth: 1, borderTopColor: c.line },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.green },
}));
