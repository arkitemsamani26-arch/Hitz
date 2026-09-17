import React from 'react';
import { Stack } from 'expo-router';
import { color } from '@/theme/tokens';
export default function GuardianLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.court } }} />;
}
