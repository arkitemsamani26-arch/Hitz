import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Rally } from '@/ui/Rally';
import { color, hit, space } from '@/theme/tokens';
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
    <Screen bottom={<Centered><Button title="Next" onPress={go} disabled={!id} /></Centered>}>
      <Centered>
        <T v="display" style={{ marginTop: space.xl }}>Where do you{'\n'}usually play?</T>
        <T v="body" tone="ink2" style={{ marginTop: space.lg, marginBottom: space.xl }}>Your home court is your location on Hits. Not your address — we never ask for one.</T>
        {!courts ? <Rally /> : courts.map(c => {
          const on = c.id === id;
          return (
            <Tap key={c.id} onPress={() => setId(c.id)} tick style={[s.row, on && s.on]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <View style={{ flex: 1 }}>
                <T v="bodyM">{c.name}</T>
                <T v="small" tone="ink2">{[c.distanceBucket, c.indoor ? 'Indoor' : 'Outdoor', c.access === 'club' ? 'Club' : 'Public'].filter(Boolean).join(' · ')}</T>
              </View>
              {on ? <Pill label="Home" tone="ball" /> : <View style={s.ring} />}
            </Tap>
          );
        })}
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: hit.row, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.line, gap: space.md },
  on: {},
  ring: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: color.lineStrong },
});
