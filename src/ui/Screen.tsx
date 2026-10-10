// Every screen is paper. Content sits in bordered cards, or straight on the page.
import React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { fixed, radius, space } from '@/theme/tokens';
import { makeStyles, useScheme, useTheme } from '@/theme/theme';
import { shadow } from '@/lib/shadow';

export const GUTTER = 20;

export function Screen({ children, scroll = true, pad = true, style, bottom, onRefresh, extraBottom = 0, flush }:
  { children: React.ReactNode; scroll?: boolean; pad?: boolean; style?: StyleProp<ViewStyle>; bottom?: React.ReactNode;
    // Pull to refresh. Passing this is what turns it on.
    onRefresh?: () => Promise<unknown> | void;
    // Extra room under the content.
    extraBottom?: number;
    // Discover: the header and hero run to the edges, so the screen adds no top padding.
    flush?: boolean;
    // Accepted and ignored, so old call sites still compile.
    sky?: number; ground?: string }) {
  const t = useTheme();
  const scheme = useScheme();
  const s = useS();
  const [refreshing, setRefreshing] = React.useState(false);
  const pull = React.useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }, [onRefresh]);
  const insets = useSafeAreaInsets();
  const inner = [pad && s.pad, { paddingTop: flush ? insets.top : insets.top + 9, paddingBottom: (bottom ? space.md : insets.bottom + space.xl) + extraBottom }, style];
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.root]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {scroll
        ? <ScrollView contentContainerStyle={[s.grow, inner]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={t.muted} colors={[t.green]} progressBackgroundColor={t.card} /> : undefined}>{children}</ScrollView>
        : <View style={[s.fill, inner]}>{children}</View>}
      {bottom && <View style={[s.bottom, { paddingBottom: insets.bottom + space.md }]}>{bottom}</View>}
    </KeyboardAvoidingView>
  );
}

// A panel: card surface, one hairline, 13px corners, 17px inside. `stripe` adds the sage
// line along the top that marks the featured thing on a screen.
export function Card({ children, style, stripe, soft, accent, loud }:
  { children: React.ReactNode; style?: StyleProp<ViewStyle>; stripe?: boolean; soft?: boolean; accent?: boolean; loud?: boolean }) {
  const s = useS();
  return (
    <View style={[s.card, (soft || loud) && s.soft, (stripe || accent) && s.striped, style]}>
      {(stripe || accent) && <View style={s.stripe} pointerEvents="none" />}
      {children}
    </View>
  );
}
export const Sheet = Card;

export const MAX_W = 520;
export function Centered({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', flex: 1 }, style]}>{children}</View>;
}

const useS = makeStyles(c => ({
  root: { flex: 1, backgroundColor: c.paper },
  grow: { flexGrow: 1 },
  // A non-scrolling screen must not grow past the viewport, or an inner list pushes the
  // bottom button off the bottom of the phone. minHeight 0 lets that list shrink instead.
  fill: { flex: 1, minHeight: 0 },
  pad: { paddingHorizontal: GUTTER },
  bottom: { paddingHorizontal: GUTTER, paddingTop: space.md, backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.line },
  card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, padding: 17, ...shadow({ y: 7, blur: 14, color: c.shadow, opacity: 0.035 }) },
  soft: { backgroundColor: c.soft },
  striped: { overflow: 'hidden', paddingTop: 17 + 4 },
  stripe: { position: 'absolute', left: 0, right: 0, top: 0, height: 4, backgroundColor: fixed.stripe },
}));
