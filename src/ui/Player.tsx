import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { Pill } from './Pill';
import { Score } from './Score';
import { Sheet } from './Screen';
import { Avatar } from './Avatar';
import { color, hit, space } from '@/theme/tokens';
import { activeText, pct } from '@/lib/format';
import { slotsOf, type Player } from '@/data/types';

export function name(p: Player) { return p.lastInitial ? `${p.displayName} ${p.lastInitial}.` : p.displayName; }

export function PlayerCard({ p, anonymous, tall }: { p: Player; anonymous?: boolean; tall?: boolean }) {
  const reply = pct(p.responseRate);
  const free = slotsOf(p.availabilityMask);
  return (
    <Sheet style={[tall && { minHeight: 320 }]} accent={p.lookingToHit}>
      <View style={s.top}>
        <Avatar name={anonymous ? '?' : p.displayName} size={52} ring />
        <View style={{ flex: 1 }}>
          <T v="h1" numberOfLines={1}>{anonymous ? 'Player' : name(p)}</T>
          <T v="small" tone="ink2" style={{ marginTop: 2 }}>{[p.distanceBucket, p.homeCourtName].filter(Boolean).join(' · ')}</T>
        </View>
        <Score value={p.levelValue} size="score" verified={p.levelVerified} tone="court" />
      </View>
      <View style={s.rule} />
      <View style={s.pills}>
        {p.lookingToHit && <Pill label="Looking to hit this week" tone="ball" />}
        <Pill label={activeText(p.lastActiveAt)} tone="faint" />
        {reply && <Pill label={`Replies ${reply}`} tone="faint" />}
        {p.hitsConfirmed > 0 && <Pill label={`${p.hitsConfirmed} hits`} tone="faint" />}
      </View>
      {tall && <View style={{ marginTop: 'auto', paddingTop: space.lg }}><T v="micro" tone="ink3">Usually free</T><T v="small" tone="ink2" style={{ marginTop: 4 }}>{free.length ? free.join(' · ') : 'Not set yet'}</T></View>}
    </Sheet>
  );
}

// One tap to request. The row is the product.
export function PlayerRow({ p, onPress, onHit, disabled }: { p: Player; onPress: () => void; onHit: () => void; disabled?: boolean }) {
  return (
    <View style={s.row}>
      <Tap onPress={onPress} style={s.rowMain} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={`${name(p)}, level ${p.levelValue}`}>
      <Avatar name={p.displayName} size={40} />
      <View style={{ width: 62, marginLeft: space.sm }}><Score value={p.levelValue} size="h1" verified={p.levelVerified} tone="court" /></View>
      <View style={{ flex: 1, marginLeft: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <T v="bodyM" numberOfLines={1}>{name(p)}</T>
          {p.lookingToHit && <View style={s.dot} accessibilityLabel="Looking to hit this week" />}
        </View>
        <T v="small" tone="ink2" numberOfLines={1}>{[p.distanceBucket, activeText(p.lastActiveAt), pct(p.responseRate) && `replies ${pct(p.responseRate)}`].filter(Boolean).join(' · ')}</T>
      </View>
      </Tap>
      <Tap onPress={onHit} disabled={disabled} style={[s.hitBtn, disabled && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel={`Request a hit with ${p.displayName}`} tick>
        <T v="smallM" tone="onCourt">Hit</T>
      </Tap>
    </View>
  );
}
const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rule: { height: 2, backgroundColor: color.paper3, marginVertical: space.md },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: hit.row + 4, borderBottomWidth: 1, borderBottomColor: color.hair },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, minHeight: hit.row + 4 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.ball, borderWidth: 1.5, borderColor: color.ink },
  hitBtn: { backgroundColor: color.court, minHeight: 44, minWidth: 64, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
});
