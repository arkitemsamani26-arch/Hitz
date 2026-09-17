import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { CourtLines } from '@/ui/Court';
import { space } from '@/theme/tokens';
import { useSession } from '@/store/session';
import { useDraft } from '@/store/onboarding';

export default function Ready() {
  const router = useRouter();
  const { profile } = useSession();
  const { reset } = useDraft();
  const pending = profile?.band === 'minor' && !profile.guardianVerified;
  return (
    <Screen scroll={false} bottom={<Centered><Button title="See who's around" onPress={() => { reset(); router.replace('/(tabs)'); }} /></Centered>}>
      <Centered>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
          <Animated.View entering={FadeInUp.springify().damping(16)}><CourtLines width={140} opacity={0.3} /></Animated.View>
          <Animated.View entering={FadeInUp.delay(120).springify().damping(16)} style={{ alignItems: 'center', gap: space.sm }}>
            <T v="display" center>You're in,{'\n'}{profile?.displayName ?? ''}.</T>
            <T v="body" tone="ink2" center style={{ maxWidth: 300, marginTop: space.sm }}>
              {pending ? "Browse away. Once your parent says yes, you can reach out — we'll tell you the second it happens." : 'Boston at your level, sorted by who you should actually hit with.'}
            </T>
          </Animated.View>
        </View>
      </Centered>
    </Screen>
  );
}
