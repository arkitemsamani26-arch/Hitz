// Home court. This is your location on Hits: a court, never an address.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Loading } from '@/ui/Loading';
import { useToast } from '@/ui/Toast';
import { hit, space, radius } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useDraft } from '@/store/onboarding';
import { useAsync } from '@/store/useAsync';
import { nearMe } from '@/lib/location';

export default function CourtPick() {
  const router = useRouter();
  const toast = useToast();
  const t = useTheme();
  const s = useS();
  const { draft, patch } = useDraft();
  const [id, setId] = useState<string | null>(draft.homeCourtId);
  const [near, setNear] = useState<string[] | null>(null);
  const [locating, setLocating] = useState(false);
  const { data: courts } = useAsync(() => api.courts(), []);

  // Sorted by how close you actually are, when you let us look.
  const list = useMemo(() => {
    if (!courts) return null;
    if (!near) return courts;
    const rank = new Map(near.map((cid, i) => [cid, i]));
    return [...courts].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
  }, [courts, near]);

  const locate = async () => {
    setLocating(true);
    try {
      const order = await nearMe(courts ?? []);
      if (order) { setNear(order); toast('Sorted by closest to you.'); }
      else toast('No location this time. Pick from the list.');
    } finally { setLocating(false); }
  };

  const go = () => { if (!id) return; patch({ homeCourtId: id }); router.push('/onboarding/name'); };

  return (
    <Screen scroll={false} bottom={<Centered><Button title="Next" arrow onPress={go} disabled={!id} /></Centered>}>
      <Centered>
        <View style={{ marginTop: space.lg, marginBottom: space.lg }}>
          <T v="eyebrow" tone="muted">Your area</T>
          <T v="display" style={{ marginTop: 12 }}>Where do you{'\n'}<T v="display" italic>play?</T></T>
          <T v="small" tone="muted" style={{ marginTop: space.md, lineHeight: 21 }}>Pick your home court. We never ask for your address, and other players only ever see a rough distance.</T>
        </View>

        {!near && (
          <Card style={st.locate}>
            <View style={{ flex: 1 }}>
              <T v="smallM">Find the closest ones</T>
              <T v="meta" tone="muted">Your position is rounded before it is saved. Or just pick from the list.</T>
            </View>
            <Button title="Use location" kind="line" small onPress={locate} loading={locating} />
          </Card>
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.xl }}>
          {!list ? <Loading label="Loading courts" /> : list.map((c, i) => {
            const on = c.id === id;
            return (
              <Tap key={c.id} onPress={() => setId(c.id)} tick style={[s.row, on && s.on]}
                accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on}>
                <Icon name="map-pin" size={16} color={on ? t.greenText : t.muted} />
                <View style={{ flex: 1 }}>
                  <T v="smallM" tone={on ? 'greenText' : 'ink'} numberOfLines={1}>{c.name}</T>
                  <T v="meta" tone={on ? 'greenText' : 'muted'} numberOfLines={1}>
                    {[near ? (i === 0 ? 'Closest to you' : null) : null, c.indoor ? 'Indoor' : 'Outdoor', c.access === 'club' ? 'Club' : 'Public'].filter(Boolean).join(' · ')}
                  </T>
                </View>
                {on && <Icon name="check" size={18} color={t.greenText} strokeWidth={2} />}
              </Tap>
            );
          })}
        </ScrollView>
      </Centered>
    </Screen>
  );
}

const st = StyleSheet.create({
  locate: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
});
const useS = makeStyles(c => ({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: hit.row, paddingVertical: 12, paddingHorizontal: 14, gap: space.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg },
  on: { backgroundColor: c.green, borderColor: c.green },
}));
