import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { Pill } from './Pill';
import { Score } from './Score';
import { Baseline, ServiceBox } from './Court';
import { color, hit, space } from '@/theme/tokens';
import { activeText, pct } from '@/lib/format';
import { slotsOf, type Player } from '@/data/types';

function name(p: Player) { return p.lastInitial ? `${p.displayName} ${p.lastInitial}.` : p.displayName; }

// The stack card. Level is the hero. Everything else is small and honest.
export function PlayerCard({ p, anonymous, tall }: { p: Player; anonymous?: boolean; tall?: boolean }) {
  const reply = pct(p.responseRate);
  const free = slotsOf(p.availabilityMask);
  return (
    <ServiceBox style={[s.card, tall && s.tall]} accent={p.lookingToHit}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <T v="h1" numberOfLines={1}>{anonymous ? 'Player' : name(p)}</T>
          <T v="small" tone="ink2" style={{ marginTop: 2 }}>{[p.distanceBucket, p.homeCourtName].filter(Boolean).join(' · ')}</T>
        </View>
        <Score value={p.levelValue} size="score" verified={p.levelVerified} />
      </View>

      <Baseline style={{ marginVertical: space.lg }} />

      <View style={s.pills}>
        {p.lookingToHit && <Pill label="Looking to hit this week" tone="ball" />}
        <Pill label={activeText(p.lastActiveAt)} tone="faint" />
        {reply && <Pill label={`Replies ${reply}`} tone="faint" />}
        {p.hitsConfirmed > 0 && <Pill label={`${p.hitsConfirmed} hits`} tone="faint" />}
      </View>
      {tall && (
        <View style={s.free}>
          <T v="micro" tone="ink3">Usually free</T>
          <T v="small" tone="ink2" style={{ marginTop: 4 }}>{free.length ? free.join(' · ') : 'Not set yet'}</T>
        </View>
      )}
    </ServiceBox>
  );
}

// The list row. One tap to request -- direction C's borrowing.
export function PlayerRow({ p, onPress, onHit, disabled }: { p: Player; onPress: () => void; onHit: () => void; disabled?: boolean }) {
  return (
    <Tap onPress={onPress} style={s.row} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={`${name(p)}, level ${p.levelValue}`}>
      <Score value={p.levelValue} size="h1" verified={p.levelVerified} />
      <View style={{ flex: 1, marginLeft: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <T v="bodyM" numberOfLines={1}>{name(p)}</T>
          {p.lookingToHit && <View style={s.dot} accessibilityLabel="Looking to hit this week" />}
        </View>
        <T v="small" tone="ink2" numberOfLines={1}>
          {[p.distanceBucket, activeText(p.lastActiveAt), pct(p.responseRate) && `replies ${pct(p.responseRate)}`].filter(Boolean).join(' · ')}
        </T>
      </View>
      <Tap onPress={onHit} disabled={disabled} style={[s.hitBtn, disabled && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel={`Request a hit with ${p.displayName}`} tick>
        <T v="smallM" tone="ball">Hit</T>
      </Tap>
    </Tap>
  );
}

const s = StyleSheet.create({
  card: { padding: space.xl },
  tall: { minHeight: 380, justifyContent: 'flex-start' },
  free: { marginTop: 'auto', paddingTop: space.xl },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: hit.row + 8, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.line },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.ball },
  hitBtn: { borderWidth: 1.5, borderColor: color.ballGlow, minHeight: 44, minWidth: 64, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
});
