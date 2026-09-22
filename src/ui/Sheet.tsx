import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './Text';
import { Tap } from './Tap';
import { color, hit, radius, space } from '@/theme/tokens';

export type SheetOption = { label: string; sub?: string; onPress: () => void; danger?: boolean };

export function OptionSheet({ open, onClose, title, options, children }: { open: boolean; onClose: () => void; title?: string; options?: SheetOption[]; children?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(120)} style={s.dim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View entering={SlideInDown.springify().damping(18).stiffness(240)} style={[s.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={s.grab} />
          {title && <T v="micro" tone="ink3" style={{ marginBottom: space.sm }}>{title}</T>}
          {children}
          {options?.map(o => (
            <Tap key={o.label} onPress={() => { onClose(); o.onPress(); }} style={s.opt} scaleTo={0.98} accessibilityRole="button">
              <T v="bodyM" tone={o.danger ? 'danger' : 'ink'}>{o.label}</T>
              {o.sub && <T v="small" tone="ink3">{o.sub}</T>}
            </Tap>
          ))}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
const s = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(14,27,51,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.paper, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.xl, gap: 2, width: '100%', maxWidth: 560, alignSelf: 'center' },
  grab: { width: 36, height: 4, borderRadius: 2, backgroundColor: color.hair2, alignSelf: 'center', marginBottom: space.lg },
  opt: { minHeight: hit.min + 4, justifyContent: 'center', paddingHorizontal: space.sm, borderBottomWidth: 1, borderBottomColor: color.hair },
});
