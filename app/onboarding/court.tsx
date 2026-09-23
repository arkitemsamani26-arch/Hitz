// Home court. This is your location on Hits: a court, never an address.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pop } from '@/ui/Pop';
import { Rally } from '@/ui/Rally';
import { useToast } from '@/ui/Toast';
import { color, hit, space, radius } from '@/theme/tokens';
import { api } from '@/data';
import { useDraft } from '@/store/onboarding';
import { useAsync } from '@/store/useAsync';
import { nearMe } from '@/lib/location';

export default function CourtPick() {
  const router = useRouter();
  const toast = useToast();
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
    <Screen scroll={false} sky={150} bottom={<Centered><Button title="Next" kind="ball" onPress={go} disabled={!id} /></Centered>}>
      <Centered>
        <View style={{ marginTop: space.lg, marginBottom: space.lg }}>
          <T v="display">Where do you play?</T>
          <T v="body" tone="ink2" style={{ marginTop: 4 }}>Pick your home court. We never ask for your address.</T>
        </View>

        {!near && (
          <Sheet style={s.locate}>
            <View style={{ flex: 1 }}>
              <T v="bodyM">Find the closest ones</T>
              <T v="small" tone="ink2">Your spot stays private. Players only see a rough distance.</T>
            </View>
            <Button title="Use location" kind="court" small onPress={locate} loading={locating} />
          </Sheet>
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.xl }}>
          {!list ? <Rally /> : list.map((c, i) => {
            const on = c.id === id;
            return (
              <Pop key={c.id} on={on}>
                <Tap onPress={() => setId(c.id)} tick style={[s.row, on && s.on]}
                  accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on}>
                  {/* A little court, kept clear of the text so nothing reads through it. */}
                  <View style={[s.glyph, on && s.glyphOn]}>
                    <View style={[s.glyphLine, on && s.glyphLineOn]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="bodyM" tone="ink" numberOfLines={1}>{c.name}</T>
                    <T v="small" tone="ink2" numberOfLines={1}>
                      {[near ? (i === 0 ? 'Closest to you' : null) : null, c.indoor ? 'Indoor' : 'Outdoor', c.access === 'club' ? 'Club' : 'Public'].filter(Boolean).join(' · ')}
                    </T>
                  </View>
                  {on && <View style={s.check}><T v="micro" tone="onBall">HOME</T></View>}
                </Tap>
              </Pop>
            );
          })}
        </ScrollView>
      </Centered>
    </Screen>
  );
}

const s = StyleSheet.create({
  locate: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: hit.row, padding: space.md, gap: space.md, backgroundColor: color.paper, borderRadius: radius.md },
  on: { backgroundColor: color.ball },
  glyph: { width: 24, height: 34, borderRadius: 4, backgroundColor: color.court, alignItems: 'center', justifyContent: 'center' },
  glyphOn: { backgroundColor: color.ink },
  glyphLine: { width: '128%', height: 2.5, backgroundColor: color.paper, borderRadius: 2 },
  glyphLineOn: { backgroundColor: color.ball },
  check: { backgroundColor: color.ink, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill },
});
