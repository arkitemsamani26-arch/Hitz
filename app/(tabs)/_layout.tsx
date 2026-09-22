import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { color, hit, radius, space } from '@/theme/tokens';
import { shadow } from '@/lib/shadow';

const LABELS: Record<string, string> = { index: 'Hits', you: 'You' };
type BarProps = { state: { index: number; routes: { key: string; name: string }[] }; navigation: { navigate: (name: string) => void } };

// Two tabs, and the whole loop lives on the first. A ball-yellow pill slides under the
// active one; the ball rides on top of it.
function Bar({ state, navigation }: BarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const n = state.routes.length;
  const barW = Math.min(width, 520) - space.lg * 2;
  const slot = barW / n;
  const x = useSharedValue(0), hop = useSharedValue(0), spin = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(state.index * slot, { damping: 15, stiffness: 180 });
    hop.value = withSequence(withTiming(-6, { duration: 110 }), withSpring(0, { damping: 8, stiffness: 320 }));
    spin.value = withSpring(state.index * 360, { damping: 16, stiffness: 120 });
  }, [state.index, slot, x, hop, spin]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const ball = useAnimatedStyle(() => ({ transform: [{ translateX: x.value + slot / 2 - 7 }, { translateY: hop.value }, { rotate: `${spin.value}deg` }] }));

  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom + space.sm }]}>
      <View style={[s.bar, { width: barW }]} accessibilityRole="tablist">
        <Animated.View style={[s.pill, { width: slot }, pill]} pointerEvents="none" />
        <Animated.View style={[s.roller, ball]} pointerEvents="none"><View style={s.seam} /></Animated.View>
        {state.routes.map((route, i) => {
          const on = state.index === i;
          return (
            <Tap key={route.key} onPress={() => navigation.navigate(route.name)} tick style={s.tab}
              accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={LABELS[route.name]}>
              <T v="bodyM" tone={on ? 'ink' : 'ink3'}>{LABELS[route.name]}</T>
            </Tap>
          );
        })}
      </View>
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
  wrap: { alignItems: 'center', paddingTop: space.sm, backgroundColor: 'transparent' },
  bar: { flexDirection: 'row', backgroundColor: color.paper, borderRadius: radius.pill, padding: 5, ...shadow({ y: 6, blur: 20, opacity: 0.28 }) },
  pill: { position: 'absolute', left: 5, top: 5, bottom: 5, backgroundColor: color.ball, borderRadius: radius.pill },
  tab: { flex: 1, minHeight: hit.min, alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  roller: { position: 'absolute', top: 9, left: 5, width: 14, height: 14, borderRadius: 7, backgroundColor: color.paper, borderWidth: 1.5, borderColor: color.ink, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  seam: { width: 9, height: 5, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(14,27,51,0.45)', backgroundColor: 'transparent' },
});
