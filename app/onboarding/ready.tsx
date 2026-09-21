import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { MemberCard } from '@/ui/MemberCard';
import { space } from '@/theme/tokens';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useDraft } from '@/store/onboarding';
import { useAsync } from '@/store/useAsync';

export default function Ready() {
  const router = useRouter();
  const { profile } = useSession();
  const { reset } = useDraft();
  const { data: courts } = useAsync(() => api.courts(), []);
  const pending = profile?.band === 'minor' && !profile.guardianVerified;
  const court = courts?.find(c => c.id === profile?.homeCourtId)?.name ?? null;
  const stage = !profile?.guardianSentAt ? 0 : !profile.guardianOpenedAt ? 1 : !profile.guardianVerified ? 2 : 3;
  return (
    <Screen sky={220} bottom={<Centered><Button title="See who's around" kind="ball" onPress={() => { reset(); router.replace('/(tabs)'); }} /></Centered>}>
      <Centered>
        <Animated.View entering={FadeInUp.springify().damping(14)} style={{ marginTop: space.xl }}>
          <T v="micro" tone="ink2">Welcome to the club</T>
          <T v="display">You're in,{'\n'}{profile?.displayName ?? ''}.</T>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(150).springify().damping(14)} style={{ marginTop: space.xl }}>
          <MemberCard name={`${profile?.displayName ?? ''} ${profile?.lastInitial ?? ''}.`} level={profile?.levelValue ?? null} verified={profile?.levelSource === 'utr_verified'} court={court} roster={profile?.rosterName} minor={profile?.band === 'minor'} photo={profile?.photoUrl} flip />
        </Animated.View>
        {pending && (
          <Animated.View entering={FadeInUp.delay(300).springify().damping(14)}>
            <Sheet style={{ gap: space.sm }}>
              <T v="micro" tone="ink3">Your parent</T>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                {['Sent', 'Opened', 'Said yes'].map((l, i) => (
                  <View key={l} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                    <View style={{ height: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: stage > i ? '#2E6FCB' : '#E3EAF5' }} />
                    <T v="small" tone={stage > i ? 'ink' : 'ink3'}>{l}</T>
                  </View>
                ))}
              </View>
              <T v="small" tone="ink2">{stage >= 2 ? "They've opened it. Reaching out unlocks the moment they tap yes." : 'Browse now. We text you the second they say yes.'}</T>
            </Sheet>
          </Animated.View>
        )}
      </Centered>
    </Screen>
  );
}
