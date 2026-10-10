import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './Text';
import { Tap } from './Tap';
import { hit, radius, space } from '@/theme/tokens';
import { makeStyles } from '@/theme/theme';

export type SheetOption = { label: string; sub?: string; onPress: () => void; danger?: boolean };

// A sheet from the bottom. 220ms up, no overshoot; the system's reduced-motion setting
// turns the slide off.
export function OptionSheet({ open, onClose, title, options, children }: { open: boolean; onClose: () => void; title?: string; options?: SheetOption[]; children?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const s = useS();
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(120)} style={s.dim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <Animated.View entering={SlideInDown.duration(220)} style={[s.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={s.grab} />
          {title && <T v="micro" tone="muted" style={{ marginBottom: space.sm }}>{title}</T>}
          {children}
          {options?.map(o => (
            <Tap key={o.label} onPress={() => { onClose(); o.onPress(); }} style={s.opt} accessibilityRole="button">
              <T v="bodyM" tone={o.danger ? 'danger' : 'ink'}>{o.label}</T>
              {o.sub && <T v="small" tone="muted">{o.sub}</T>}
            </Tap>
          ))}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
const useS = makeStyles(c => ({
  dim: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.card, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, borderTopWidth: 1, borderColor: c.line, padding: 22, gap: 2, width: '100%', maxWidth: 560, alignSelf: 'center' },
  grab: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.line, alignSelf: 'center', marginBottom: space.lg },
  opt: { minHeight: hit.min + 4, justifyContent: 'center', paddingHorizontal: space.xs, borderBottomWidth: 1, borderBottomColor: c.line },
}));
