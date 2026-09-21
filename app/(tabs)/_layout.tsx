import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withSequence, withTiming } from 'react-native-reanimated';
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
  const { width } = useWindowDimensions();
  const n = state.routes.length;
  const inner = Math.min(width, 520) - space.xxl * 2;
  const x = useSharedValue(0), hop = useSharedValue(0), spin = useSharedValue(0);
  useEffect(() => {
    // The ball rolls to the active tab: a short hop, then it lands and spins to a stop.
    x.value = withSpring(state.index * (inner / n) + inner / n / 2 - 6, { damping: 14, stiffness: 160 });
    hop.value = withSequence(withTiming(-10, { duration: 120 }), withSpring(0, { damping: 8, stiffness: 300 }));
    spin.value = withSpring(state.index * 360, { damping: 16, stiffness: 120 });
  }, [state.index, inner, n, x, hop, spin]);
  const ball = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: hop.value }, { rotate: `${spin.value}deg` }] }));
  return (
    <View style={[s.bar, { paddingBottom: insets.bottom + space.sm }]} accessibilityRole="tablist">
      <Animated.View style={[s.roller, ball]} pointerEvents="none"><View style={s.seam} /></Animated.View>
      {state.routes.map((route, i) => {
        const on = state.index === i;
        return (
          <Tap key={route.key} onPress={() => navigation.navigate(route.name)} tick style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={LABELS[route.name]}>
            <View style={s.ball} />
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
  bar: { flexDirection: 'row', backgroundColor: color.paper, borderTopWidth: 3, borderTopColor: color.line, paddingTop: space.sm, paddingHorizontal: space.xxl, maxWidth: 520, width: '100%', alignSelf: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } },
  tab: { flex: 1, minHeight: hit.min, alignItems: 'center', justifyContent: 'center', gap: 5 },
  ball: { width: 12, height: 12 },
  roller: { position: 'absolute', top: 10, left: space.xxl, width: 12, height: 12, borderRadius: 6, backgroundColor: color.ball, borderWidth: 1.5, borderColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  seam: { width: 8, height: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(14,27,51,0.5)', backgroundColor: 'transparent' },
});
