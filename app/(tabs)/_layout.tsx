import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tap } from '@/ui/Tap';
import { Icon, type IconName } from '@/ui/Icon';
import { font } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { api } from '@/data';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Discover', icon: 'compass' },
  { name: 'hits', label: 'My hits', icon: 'calendar-days' },
  { name: 'you', label: 'Club card', icon: 'id-card' },
];

// The bar sits in the layout under the content, not over it, so screens need no padding
// for it. Kept so old call sites still compile.
export const TAB_BAR_H = 0;
type BarProps = { state: { index: number; routes: { key: string; name: string }[] }; navigation: { navigate: (name: string) => void } };

// Three equal destinations on the card surface, a hairline above, the chosen one on the
// soft green. A small dot on My hits when an invitation is waiting on you.
function Bar({ state, navigation }: BarProps) {
  const t = useTheme();
  const s = useS();
  const insets = useSafeAreaInsets();
  const { profile, tick } = useSession();
  const reqs = useAsync(() => api.requests(), [tick]);
  const waiting = (reqs.data ?? []).filter(r => (r.state === 'pending' || r.state === 'countered') && r.awaitingId === profile?.id).length;
  return (
    <View style={[s.bar, { paddingBottom: insets.bottom + 11 }]} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const tab = TABS.find(x => x.name === route.name); if (!tab) return null;
        const on = state.index === i;
        const dot = tab.name === 'hits' && waiting > 0;
        return (
          <Tap key={route.key} onPress={() => navigation.navigate(route.name)} style={[s.tab, on && s.tabOn]}
            accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={dot ? `${tab.label}, ${waiting} waiting on you` : tab.label}>
            <View>
              <Icon name={tab.icon} size={18} color={on ? t.ink : t.muted} />
              {dot && <View style={s.dot} />}
            </View>
            <Text style={[s.label, { color: on ? t.ink : t.muted }]} maxFontSizeMultiplier={1.3}>{tab.label}</Text>
          </Tap>
        );
      })}
    </View>
  );
}
export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs tabBar={(p: any) => <Bar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.paper } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="hits" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
const useS = makeStyles(c => ({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 5, paddingTop: 8, paddingHorizontal: 9, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line },
  tab: { flex: 1, maxWidth: 160, minHeight: 49, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 5 },
  tabOn: { backgroundColor: c.soft },
  label: { fontFamily: font.medium, fontSize: 11, lineHeight: 14 },
  dot: { position: 'absolute', top: -2, right: -5, width: 7, height: 7, borderRadius: 4, backgroundColor: c.green, borderWidth: 1, borderColor: c.card },
}));
