import React from 'react';
import { View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Progress } from '@/ui/Progress';
import { color, space } from '@/theme/tokens';

const STEPS = ['phone', 'code', 'name', 'birthday', 'level', 'peek', 'court', 'availability', 'guardian', 'ready'];

export default function OnboardingLayout() {
  const path = usePathname();
  const step = STEPS.findIndex(s => path.endsWith(`/${s}`));
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: color.court }}>
      <View style={{ paddingTop: insets.top + space.md, paddingHorizontal: space.xl, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
        <Progress value={(Math.max(step, 0) + 1) / STEPS.length} />
      </View>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.court }, animation: 'slide_from_right' }} />
    </View>
  );
}
