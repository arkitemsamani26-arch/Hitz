// Let them see something good before asking for more.
import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { PlayerCard } from '@/ui/Player';
import { Rally } from '@/ui/Rally';
import { space } from '@/theme/tokens';
import { api } from '@/data';
import { useDraft, isMinor } from '@/store/onboarding';
import { useAsync } from '@/store/useAsync';

export default function Peek() {
  const router = useRouter();
  const { draft } = useDraft();
  const band = isMinor(draft.dateOfBirth) ? 'minor' : 'adult';
  const { data, loading } = useAsync(() => api.peek(draft.levelValue ?? 6, band), [draft.levelValue, band]);
  return (
    <Screen bottom={<Centered><Button title="Keep going" onPress={() => router.push('/onboarding/court')} /></Centered>}>
      <Centered>
        {loading || !data ? <Rally label="Looking around Boston…" /> : (
          <>
            <View style={{ marginTop: space.xl, marginBottom: space.xl }}>
              <T v="display" tone="ball">{data.count}</T>
              <T v="h1">{band === 'minor' ? 'juniors' : 'players'} around your level near Boston.</T>
              <T v="body" tone="ink2" style={{ marginTop: space.sm }}>Two more questions and you'll see who they are.</T>
            </View>
            <View style={{ gap: space.md }}>
              {data.sample.map((p, i) => (
                <Animated.View key={p.id} entering={FadeInDown.delay(i * 90).springify().damping(18)}>
                  <PlayerCard p={p} anonymous />
                </Animated.View>
              ))}
            </View>
          </>
        )}
      </Centered>
    </Screen>
  );
}
