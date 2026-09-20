import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Rally } from '@/ui/Rally';
import { color, hit, space, radius } from '@/theme/tokens';
import { api } from '@/data';
import { useDraft } from '@/store/onboarding';
import { useAsync } from '@/store/useAsync';

export default function CourtPick() {
  const router = useRouter();
  const { draft, patch } = useDraft();
  const [id, setId] = useState<string | null>(draft.homeCourtId);
  const { data: courts } = useAsync(() => api.courts(), []);
  const go = () => { if (!id) return; patch({ homeCourtId: id }); router.push('/onboarding/availability'); };
  return (
    <Screen sky={340} bottom={<Centered><Button title="Next" kind="ball" onPress={go} disabled={!id} /></Centered>}>
      <Centered>
        <T v="display" style={{ marginTop: space.xl }}>Where do you{'\n'}usually play?</T>
        <T v="body" tone="ink2" style={{ marginTop: space.md, marginBottom: space.lg }}>Your home court is your location on Hits. Not your address — we never ask for one.</T>
        <View style={{ gap: space.sm }}>{!courts ? <Rally /> : courts.map(c => {
          const on = c.id === id;
          return (
            // Courts are courts: each option is a little court, and yours turns ball-yellow.
            <Tap key={c.id} onPress={() => setId(c.id)} tick style={[s.row, on && s.on]} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on}>
              <View style={[s.alley, on && s.alleyOn]} pointerEvents="none" />
              <View style={{ flex: 1 }}>
                <T v="bodyM" tone={on ? 'onBall' : 'onCourt'}>{c.name}</T>
                <T v="small" tone={on ? 'onBall' : 'onCourt'}>{[c.distanceBucket, c.indoor ? 'Indoor' : 'Outdoor', c.access === 'club' ? 'Club' : 'Public'].filter(Boolean).join(' · ')}</T>
              </View>
              {on ? <Pill label="Home" tone="white" /> : null}
            </Tap>
          );
        })}</View>
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: hit.row, paddingVertical: space.md, paddingHorizontal: space.lg, gap: space.md, backgroundColor: color.court, borderWidth: 2.5, borderColor: color.line, borderRadius: radius.sm, overflow: 'hidden' },
  on: { backgroundColor: color.ball, borderColor: color.ink },
  alley: { position: 'absolute', left: '12%', right: '12%', top: 0, bottom: 0, borderLeftWidth: 2, borderRightWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  alleyOn: { borderColor: 'rgba(14,27,51,0.3)' },
});
