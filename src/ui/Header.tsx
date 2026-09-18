import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { T } from './Text';
import { Tap } from './Tap';
import { hit, space } from '@/theme/tokens';

export function Header({ title, right, back = true, kicker }: { title?: string; right?: React.ReactNode; back?: boolean; kicker?: string }) {
  const router = useRouter();
  return (
    <View style={s.row}>
      {back ? (
        <Tap onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={s.back} accessibilityRole="button" accessibilityLabel="Back" tick>
          <T v="h2" tone="ink">←</T>
        </Tap>
      ) : <View style={s.back} />}
      <View style={{ flex: 1, alignItems: 'center' }}>
        {kicker && <T v="micro" tone="ink2">{kicker}</T>}
        {title && <T v="bodyM" numberOfLines={1}>{title}</T>}
      </View>
      <View style={[s.back, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md, minHeight: hit.min },
  back: { width: 56, minHeight: hit.min, justifyContent: 'center' },
});
