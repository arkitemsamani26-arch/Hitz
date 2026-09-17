import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { color, hit, space } from '@/theme/tokens';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { api } from '@/data';

const LABELS: Record<string, string> = { index: 'Hits', requests: 'Requests', you: 'You' };

type BarProps = { state: { index: number; routes: { key: string; name: string }[] }; navigation: { navigate: (name: string) => void } };

function Bar({ state, navigation }: BarProps) {
  const insets = useSafeAreaInsets();
  const { tick, profile } = useSession();
  const { data: reqs } = useAsync(() => api.requests(), [tick]);
  const myMove = (reqs ?? []).filter(r => (r.state === 'pending' || r.state === 'countered') && r.awaitingId === profile?.id).length;
  return (
    <View style={[s.bar, { paddingBottom: insets.bottom + space.sm }]}>
      {state.routes.map((route: { key: string; name: string }, i: number) => {
        const on = state.index === i;
        const badge = route.name === 'requests' ? myMove : 0;
        return (
          <Tap key={route.key} onPress={() => navigation.navigate(route.name)} tick style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={LABELS[route.name]}>
            <View style={[s.mark, on && s.markOn]} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <T v="smallM" tone={on ? 'ink' : 'ink3'}>{LABELS[route.name]}</T>
              {badge > 0 && <View style={s.badge}><T v="micro" tone="onBall">{badge}</T></View>}
            </View>
          </Tap>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p: any) => <Bar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.court } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="requests" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
const s = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: color.court, borderTopWidth: 2, borderTopColor: color.lineStrong, paddingTop: space.sm, paddingHorizontal: space.md },
  tab: { flex: 1, minHeight: hit.min, alignItems: 'center', justifyContent: 'center', gap: 6 },
  mark: { width: 18, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  markOn: { backgroundColor: color.ball },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: color.ball, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
});
