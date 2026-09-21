import React from 'react';
import { View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Progress } from '@/ui/Progress';
import { color, space } from '@/theme/tokens';

const STEPS = ['phone', 'code', 'name', 'photo', 'birthday', 'level', 'peek', 'court', 'availability', 'guardian', 'ready'];

export default function OnboardingLayout() {
  const path = usePathname();
  const step = STEPS.findIndex(s => path.endsWith(`/${s}`));
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: color.ground }}>
      <View style={{ position: 'absolute', zIndex: 2, left: 0, right: 0, paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
        <Progress value={(Math.max(step, 0) + 1) / STEPS.length} />
      </View>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ground }, animation: 'slide_from_right' }} />
    </View>
  );
}
