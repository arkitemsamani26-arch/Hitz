// A simple bottom sheet for choices. Web-safe, no native modal quirks.
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './Text';
import { Tap } from './Tap';
import { color, hit, radius, space } from '@/theme/tokens';

export type SheetOption = { label: string; sub?: string; onPress: () => void; danger?: boolean };

export function Sheet({ open, onClose, title, options }: { open: boolean; onClose: () => void; title?: string; options: SheetOption[] }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(120)} style={s.dim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View entering={SlideInDown.springify().damping(20).stiffness(220)} style={[s.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={s.grab} />
          {title && <T v="micro" tone="ink3" style={{ marginBottom: space.sm }}>{title}</T>}
          {options.map(o => (
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
  dim: { flex: 1, backgroundColor: 'rgba(5,9,18,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.court2, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.xl, gap: 2, borderTopWidth: 1, borderColor: color.line, width: '100%', maxWidth: 560, alignSelf: 'center' },
  grab: { width: 36, height: 4, borderRadius: 2, backgroundColor: color.lineStrong, alignSelf: 'center', marginBottom: space.lg },
  opt: { minHeight: hit.min + 4, justifyContent: 'center', paddingHorizontal: space.sm, borderBottomWidth: 1, borderBottomColor: color.lineFaint },
});
