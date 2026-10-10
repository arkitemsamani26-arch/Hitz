// Let them see something good before asking for more.
import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { PlayerCard } from '@/ui/Player';
import { Loading } from '@/ui/Loading';
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
    <Screen bottom={<Centered><Button title="Keep going" arrow onPress={() => router.push('/onboarding/availability')} /></Centered>}>
      <Centered>
        {loading || !data ? <Loading label="Looking around Palo Alto" /> : (
          <>
            <View style={{ marginTop: space.xl, marginBottom: space.xl }}>
              {/* A real launch starts at zero. "0 players" is a door closing; being early
                  is a reason to stay. Either way the number is the true one. */}
              <T v="eyebrow" tone="muted">A first look</T>
              {data.count > 0 ? (<>
                <T v="display" style={{ marginTop: 12 }}>{data.count} {who}{'\n'}<T v="display" italic>around your level.</T></T>
                <T v="small" tone="muted" style={{ marginTop: space.md, lineHeight: 21 }}>Near Palo Alto. Two more questions and you'll see who they are.</T>
              </>) : (<>
                <T v="display" style={{ marginTop: 12 }}>You're early.{'\n'}<T v="display" italic>That's a good thing.</T></T>
                <T v="small" tone="muted" style={{ marginTop: space.md, lineHeight: 21 }}>Palo Alto is still filling up. Finish your card and you're first in line when {who} at your level show up.</T>
              </>)}
            </View>
            {/* Nobody is named here. Against the live backend the sample is always empty,
                because a user with no profile row is not allowed to see anyone -- so the
                cohort is drawn instead of listed. */}
            {data.sample.length > 0 ? (
              <View style={{ gap: space.md }}>
                {data.sample.map(p => <PlayerCard key={p.id} p={p} anonymous />)}
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
