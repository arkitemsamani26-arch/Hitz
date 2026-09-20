import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { color, hit, space } from '@/theme/tokens';

const LABELS: Record<string, string> = { index: 'Hits', you: 'You' };
type BarProps = { state: { index: number; routes: { key: string; name: string }[] }; navigation: { navigate: (name: string) => void } };

// Two tabs. The core loop lives on one of them.
function Bar({ state, navigation }: BarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { paddingBottom: insets.bottom + space.sm }]} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const on = state.index === i;
        return (
          <Tap key={route.key} onPress={() => navigation.navigate(route.name)} tick style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={LABELS[route.name]}>
            <View style={[s.ball, on && s.ballOn]} />
            <T v="smallM" tone={on ? 'ink' : 'ink3'}>{LABELS[route.name]}</T>
          </Tap>
        );
      })}
    </View>
  );
}
export default function TabsLayout() {
  return (
    <Tabs tabBar={(p: any) => <Bar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.ground } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
const s = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: color.paper, borderTopWidth: 3, borderTopColor: color.line, paddingTop: space.sm, paddingHorizontal: space.xxl },
  tab: { flex: 1, minHeight: hit.min, alignItems: 'center', justifyContent: 'center', gap: 5 },
  ball: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'transparent' },
  ballOn: { backgroundColor: color.ball, borderWidth: 1.5, borderColor: color.ink },
});
