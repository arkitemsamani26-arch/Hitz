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
import { useBus } from '@/store/bus';
import { api } from '@/data';

// Five places, the way a sports app is laid out: find people, find courts, your
// schedule, your conversations, you.
const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Discover', icon: 'compass' },
  { name: 'courts', label: 'Courts', icon: 'map' },
  { name: 'hits', label: 'My hits', icon: 'calendar-days' },
  { name: 'messages', label: 'Messages', icon: 'message-circle' },
  { name: 'you', label: 'Profile', icon: 'circle-user-round' },
];

// The bar sits in the layout under the content, not over it, so screens need no padding
// for it. Kept so old call sites still compile.
export const TAB_BAR_H = 0;
type BarProps = { state: { index: number; routes: { key: string; name: string }[] }; navigation: { navigate: (name: string) => void } };

// Five equal destinations on the card surface, a hairline above, the chosen one on the
// soft green. A dot on My hits when an invitation is waiting on you; on Messages, the
// number of messages you have not opened.
function Bar({ state, navigation }: BarProps) {
  const t = useTheme();
  const s = useS();
  const insets = useSafeAreaInsets();
  const { profile, tick } = useSession();
  const read = useBus('inbox');
  const reqs = useAsync(() => api.requests(), [tick]);
  const inbox = useAsync(() => api.inbox(), [tick, read]);
  const waiting = (reqs.data ?? []).filter(r => (r.state === 'pending' || r.state === 'countered') && r.awaitingId === profile?.id).length;
  const unread = (inbox.data ?? []).reduce((n, x) => n + x.unread, 0);
  return (
    <View style={[s.bar, { paddingBottom: insets.bottom + 11 }]} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const tab = TABS.find(x => x.name === route.name); if (!tab) return null;
        const on = state.index === i;
        const dot = tab.name === 'hits' && waiting > 0;
        const count = tab.name === 'messages' ? unread : 0;
        const label = dot ? `${tab.label}, ${waiting} waiting on you` : count ? `${tab.label}, ${count} unread` : tab.label;
        return (
          <Tap key={route.key} onPress={() => navigation.navigate(route.name)} style={[s.tab, on && s.tabOn]}
            accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label}>
            <View>
              <Icon name={tab.icon} size={19} color={on ? t.ink : t.muted} />
              {dot && <View style={s.dot} />}
              {count > 0 && <View style={s.badge}><Text style={s.badgeText} maxFontSizeMultiplier={1.2}>{count > 9 ? '9+' : count}</Text></View>}
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
      <Tabs.Screen name="courts" />
      <Tabs.Screen name="hits" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
const useS = makeStyles(c => ({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 2, paddingTop: 7, paddingHorizontal: 6, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line },
  tab: { flex: 1, maxWidth: 120, minHeight: 50, paddingVertical: 7, paddingHorizontal: 2, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabOn: { backgroundColor: c.soft },
  label: { fontFamily: font.medium, fontSize: 11, lineHeight: 14 },
  dot: { position: 'absolute', top: -2, right: -5, width: 8, height: 8, borderRadius: 4, backgroundColor: c.green, borderWidth: 1, borderColor: c.card },
  badge: { position: 'absolute', top: -6, right: -11, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#A8371B', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: c.card },
  badgeText: { color: '#FFFFFF', fontFamily: font.bold, fontSize: 10, lineHeight: 12 },
}));
