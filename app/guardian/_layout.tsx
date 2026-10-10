import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/theme/theme';
export default function GuardianLayout() {
  const t = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.paper } }} />;
}
