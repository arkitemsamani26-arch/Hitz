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
import { Ladder } from '@/ui/Ladder';
import { space } from '@/theme/tokens';
import { api } from '@/data';
import { useDraft, isMinor } from '@/store/onboarding';
import { useAsync } from '@/store/useAsync';

export default function Peek() {
  const router = useRouter();
  const { draft } = useDraft();
  const band = isMinor(draft.dateOfBirth) ? 'minor' : 'adult';
  const dob = draft.dateOfBirth ?? '2000-01-01';
  const { data, loading } = useAsync(() => api.peek(draft.levelValue ?? 6, dob), [draft.levelValue, dob]);
  const who = band === 'minor' ? 'juniors' : 'players';
  return (
    <Screen sky={220} bottom={<Centered><Button title="Keep going" kind="ball" onPress={() => router.push('/onboarding/availability')} /></Centered>}>
      <Centered>
        {loading || !data ? <Rally label="Looking around Palo Alto…" a={(draft.levelValue ?? 6).toFixed(1)} /> : (
          <>
            <View style={{ marginTop: space.xl, marginBottom: space.xl }}>
              {/* A real launch starts at zero. "0 players" is a door closing; being early
                  is a reason to stay. Either way the number is the true one. */}
              {data.count > 0 ? (<>
                <T v="display" tone="court" style={{ fontSize: 56, lineHeight: 56 }}>{data.count}</T>
                <T v="h1">{who} around your level near Palo Alto.</T>
                <T v="body" tone="ink2" style={{ marginTop: space.sm }}>Two more questions and you'll see who they are.</T>
              </>) : (<>
                <T v="display" tone="court" style={{ fontSize: 48, lineHeight: 50 }}>You're early.</T>
                <T v="h1">Palo Alto is still filling up.</T>
                <T v="body" tone="ink2" style={{ marginTop: space.sm }}>Finish your card and you're first in line when {who} at your level show up.</T>
              </>)}
            </View>
            {/* Nobody is named here. Against the live backend the sample is always empty,
                because a user with no profile row is not allowed to see anyone -- so the
                cohort is drawn instead of listed. */}
            {data.sample.length > 0 ? (
              <View style={{ gap: space.md }}>
                {data.sample.map((p, i) => (
                  <Animated.View key={p.id} entering={FadeInDown.delay(i * 90).springify().damping(18)}>
                    <PlayerCard p={p} anonymous />
                  </Animated.View>
                ))}
              </View>
            ) : (
              <Ladder count={data.count} label={who} />
            )}
          </>
        )}
      </Centered>
    </Screen>
  );
}
