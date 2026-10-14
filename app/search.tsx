// Search. A friend's name, or a court's. Finds anyone you could invite, at any level and
// any distance in range, because a name you already know beats any filter.
import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Header } from '@/ui/Header';
import { Icon } from '@/ui/Icon';
import { Loading } from '@/ui/Loading';
import { CompactRow } from '@/ui/Player';
import { font, hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { courtFacts } from '@/lib/courts';

export default function Search() {
  const router = useRouter();
  const t = useTheme();
  const s = useS();
  const { tick } = useSession();
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const players = useAsync(() => api.discover({ radiusMi: 25, levelLo: null, levelHi: null, availability: 0, onlyLooking: false, ageGap: null }), [tick]);
  const courts = useAsync(() => api.courts(), []);
  const needle = q.trim().toLowerCase();
  const found = useMemo(() => {
    if (!needle) return { players: (players.data ?? []).filter(p => p.lookingToHit).slice(0, 6), courts: [] as NonNullable<typeof courts.data> };
    const words = needle.split(/\s+/);
    return {
      players: (players.data ?? []).filter(p => {
        const full = `${p.displayName} ${p.lastInitial ?? ''}`.toLowerCase();
        return words.every(w => full.includes(w));
      }),
      courts: (courts.data ?? []).filter(c => c.name.toLowerCase().includes(needle) || (c.address ?? '').toLowerCase().includes(needle)),
    };
  }, [needle, players.data, courts.data]);

  return (
    <Screen>
      <Centered>
        <Header backLabel="Back" />
        <View style={[s.box, focus && s.boxOn]}>
          <Icon name="search" size={18} color={t.muted} />
          <TextInput value={q} onChangeText={setQ} autoFocus placeholder="A player's name, or a court" placeholderTextColor={t.muted}
            style={s.input} accessibilityLabel="Search players and courts" returnKeyType="search" autoCorrect={false} autoCapitalize="words"
            onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
          {!!q && (
            <Tap onPress={() => setQ('')} style={st.clear} accessibilityRole="button" accessibilityLabel="Clear the search">
              <Icon name="x" size={16} color={t.muted} />
            </Tap>
          )}
        </View>

        {players.loading && !players.data ? <Loading /> : (
          <>
            {(found.players.length > 0 || needle) && (
              <T v="micro" tone="muted" style={st.k}>{needle ? 'Players' : 'Looking to hit this week'}</T>
            )}
            {found.players.length > 0 ? (
              <Card style={{ paddingVertical: 2 }}>
                {found.players.map((p, i) => <CompactRow key={p.id} p={p} first={i === 0} onPress={() => router.push(`/player/${p.id}`)} />)}
              </Card>
            ) : needle ? (
              <T v="small" tone="muted">Nobody called "{q.trim()}" within 25 miles. They may not have joined yet; invite them from your profile.</T>
            ) : null}

            {found.courts.length > 0 && (
              <>
                <T v="micro" tone="muted" style={st.k}>Courts</T>
                <Card style={{ paddingVertical: 2 }}>
                  {found.courts.map((c, i) => (
                    <Tap key={c.id} onPress={() => router.push(`/court/${c.id}`)} style={[st.row, i > 0 && s.rule]} accessibilityRole="button" accessibilityLabel={`${c.name}. ${courtFacts(c)}. Open.`}>
                      <Icon name="map-pin" size={17} color={t.ink} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T v="smallM" numberOfLines={1}>{c.name}</T>
                        <T v="meta" tone="muted" numberOfLines={1}>{courtFacts(c)}</T>
                      </View>
                      <Icon name="chevron-right" size={15} color={t.muted} />
                    </Tap>
                  ))}
                </Card>
              </>
            )}
          </>
        )}
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  k: { marginTop: 22, marginBottom: 10 },
  clear: { width: hit.min, height: hit.min, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: hit.row, paddingVertical: 10 },
});
const useS = makeStyles(c => ({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 50, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, marginTop: space.sm },
  boxOn: { borderColor: c.green, borderWidth: 2, paddingHorizontal: 13 },
  // The box shows focus itself; the browser's own outline inside it is a second one.
  input: { flex: 1, color: c.ink, fontFamily: font.regular, fontSize: 16, paddingVertical: 12, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null) },
  rule: { borderTopWidth: 1, borderTopColor: c.line },
}));
