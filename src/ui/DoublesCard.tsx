// A doubles game, from any of the four. Each invitation in it is still its own two-person
// hit with its own messages and parents; this card is the one place that shows the whole
// court: whose side, who has said yes, which spots are still open.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { T } from './Text';
import { Tap } from './Tap';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useAsync } from '@/store/useAsync';
import type { DoublesMember, HitRequest, HitState } from '@/data/types';

const LIVE: HitState[] = ['pending', 'countered', 'accepted', 'confirmed', 'completed'];

function stateText(m: DoublesMember): string {
  if (m.role === 'organizer') return 'Set it up';
  switch (m.state) {
    case 'pending': case 'countered': return 'Invited';
    case 'accepted': return 'In · waiting on a parent';
    case 'confirmed': return 'In';
    case 'completed': return 'Played';
    case 'declined': return 'Passed';
    default: return 'Not coming';
  }
}

export function DoublesCard({ r, me, tick }: { r: HitRequest; me: string; tick: number }) {
  const router = useRouter();
  const t = useTheme();
  const s = useS();
  const { data } = useAsync(() => (r.matchId ? api.doublesMatch(r.matchId) : Promise.resolve([])), [r.matchId, tick, r.state]);
  const all = data ?? [];
  const live = all.filter(m => m.role === 'organizer' || (m.state && LIVE.includes(m.state)));
  const organizer = live.find(m => m.role === 'organizer') ?? null;
  const partner = live.find(m => m.role === 'partner') ?? null;
  const opponents = live.filter(m => m.role === 'opponent');
  const passed = all.filter(m => m.role !== 'organizer' && m.state && !LIVE.includes(m.state));
  const mine = r.fromId === me;
  const open = r.state !== 'declined' && r.state !== 'cancelled' && r.state !== 'expired' && new Date(r.windowEnd) > new Date();

  const spot = (m: DoublesMember | null, label: string) => m ? (
    <Tap key={m.id} onPress={() => m.id === me ? undefined : m.hitId && m.hitId !== r.id ? router.push(`/hit/${m.hitId}`) : router.push(`/player/${m.id}`)}
      style={s.spot} accessibilityRole="button" disabled={m.id === me}
      accessibilityLabel={`${m.id === me ? 'You' : m.displayName}${m.age != null ? `, age ${m.age}` : ''}. ${stateText(m)}.`}>
      <Avatar name={m.displayName} lastInitial={m.lastInitial} photo={m.photoUrl} size={40} />
      <T v="smallM" numberOfLines={1} style={{ marginTop: 6 }}>{m.id === me ? 'You' : m.displayName}</T>
      <T v="meta" tone={m.state === 'confirmed' || m.state === 'completed' ? 'green' : 'muted'} numberOfLines={1}>
        {[m.levelValue != null ? m.levelValue.toFixed(1) : null, stateText(m)].filter(Boolean).join(' · ')}
      </T>
    </Tap>
  ) : (
    <View key={label} style={[s.spot, s.empty]} accessible accessibilityLabel={`${label}: open`}>
      <View style={s.hole}><Icon name="plus" size={16} color={t.muted} /></View>
      <T v="smallM" tone="muted" numberOfLines={1} style={{ marginTop: 6 }}>{label}</T>
      <T v="meta" tone="muted">Open</T>
    </View>
  );

  return (
    <>
      <T v="micro" tone="muted" style={st.k}>Doubles</T>
      <View style={s.card}>
        <T v="meta" tone="muted" style={{ marginBottom: 8 }}>{organizer?.id === me ? 'Your side' : `${organizer?.displayName ?? 'Their'}'s side`}</T>
        <View style={st.side}>{spot(organizer, 'Organizer')}{spot(partner, 'Partner')}</View>
        <View style={s.net} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><View style={s.netLine} /><T v="micro" tone="muted" style={{ fontSize: 9 }}>NET</T><View style={s.netLine} /></View>
        <T v="meta" tone="muted" style={{ marginBottom: 8 }}>Across the net</T>
        <View style={st.side}>{spot(opponents[0] ?? null, 'Opponent')}{spot(opponents[1] ?? null, 'Opponent')}</View>
        {passed.length > 0 && mine && (
          <T v="meta" tone="muted" style={{ marginTop: space.sm }}>{passed.map(m => m.displayName).join(', ')} couldn't make it.</T>
        )}
        {mine && open && (!partner || opponents.length < 2) && (
          <View style={st.actions}>
            {!partner && <Button title="Find a partner" small kind={opponents.length < 2 ? 'line' : 'primary'} icon="users-round"
              onPress={() => router.push({ pathname: '/doubles/[id]', params: { id: r.id, role: 'partner' } })} style={{ flexGrow: 1 }} />}
            {opponents.length < 2 && <Button title={opponents.length ? 'Find one more opponent' : 'Find opponents'} small icon="users-round"
              onPress={() => router.push({ pathname: '/doubles/[id]', params: { id: r.id, role: 'opponent' } })} style={{ flexGrow: 1 }} />}
          </View>
        )}
        <T v="meta" tone="muted" style={{ marginTop: space.sm, lineHeight: 18 }}>
          {mine ? 'Each player gets their own invitation from you, and their own messages with you.' : `${organizer?.displayName ?? 'The organizer'} invites the others. Your messages here are with them.`}
        </T>
      </View>
    </>
  );
}

const st = StyleSheet.create({
  k: { marginTop: 24, marginBottom: 10 },
  side: { flexDirection: 'row', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: space.md },
});
const useS = makeStyles(c => ({
  card: { padding: 14, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  spot: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, borderRadius: radius.md, backgroundColor: c.soft, minHeight: hit.row },
  empty: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.line },
  hole: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.muted, alignItems: 'center', justifyContent: 'center' },
  net: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  netLine: { flex: 1, height: 1, backgroundColor: c.line },
}));
