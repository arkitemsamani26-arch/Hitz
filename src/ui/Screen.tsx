import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { color, space } from '@/theme/tokens';

// Every screen does one thing. This is the frame it does it in.
export function Screen({ children, scroll = true, pad = true, style, bottom }:
  { children: React.ReactNode; scroll?: boolean; pad?: boolean; style?: StyleProp<ViewStyle>; bottom?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const inner = [pad && s.pad, { paddingTop: insets.top + space.md, paddingBottom: bottom ? space.md : insets.bottom + space.xl }, style];
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.root}>
      <StatusBar style="light" />
      {scroll
        ? <ScrollView contentContainerStyle={[s.grow, inner]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        : <View style={[s.grow, inner]}>{children}</View>}
      {bottom && <View style={[s.bottom, { paddingBottom: insets.bottom + space.lg }]}>{bottom}</View>}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.court },
  grow: { flexGrow: 1 },
  pad: { paddingHorizontal: space.xl },
  bottom: { paddingHorizontal: space.xl, paddingTop: space.md, backgroundColor: color.court },
});

export const MAX_W = 520;
export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', flex: 1 }}>{children}</View>;
}
