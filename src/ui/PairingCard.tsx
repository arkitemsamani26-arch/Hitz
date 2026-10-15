// A coach's suggestion, the way a player sees it: who the coach wants you to hit with, when
// and where if the coach said, the coach's note, and one button that turns it into an
// ordinary invitation with all of that filled in.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Tap } from './Tap';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Score } from './Score';
import { font, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { hitShort } from '@/lib/format';
import type { Court, Pairing } from '@/data/types';

export function PairingCard({ x, courts, onSend, onDismiss, onOpen, locked }:
  { x: Pairing; courts: Court[] | null; onSend: () => void; onDismiss: () => void; onOpen: () => void; locked?: boolean }) {
  const t = useTheme();
  const s = useS();
  const court = courts?.find(c => c.id === x.courtId)?.name ?? null;
  const first = x.coachName.split(' ')[0];
  const when = x.windowStart ? `${hitShort(x.windowStart)}${court ? ` · ${court}` : ''}` : court ? `At ${court}, you two pick the time` : 'You two pick the time and court';
  return (
    <View style={s.card}>
      <View style={st.head}>
        <View style={s.badge}><Icon name="handshake" size={14} color={t.greenText} /></View>
        <T v="micro" tone="muted" style={{ flex: 1, fontSize: 10 }} numberOfLines={1}>Coach {first} · {x.academy}</T>
      </View>
      <Tap onPress={onOpen} style={st.who} accessibilityRole="button"
        accessibilityLabel={`Coach ${first} paired you with ${x.other.displayName}${x.other.lastInitial ? ` ${x.other.lastInitial}.` : ''}. ${when}. Open their profile.`}>
        <Avatar name={x.other.displayName} lastInitial={x.other.lastInitial} photo={x.other.photoUrl} size={48} dot={x.other.lookingToHit} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="h2" numberOfLines={1}>Hit with {x.other.displayName}{x.other.lastInitial ? ` ${x.other.lastInitial}.` : ''}</T>
          <T v="meta" tone="muted" numberOfLines={1}>{when}</T>
        </View>
        <Score value={x.other.levelValue} source={x.other.levelSource} verified={x.other.levelVerified} sans />
      </Tap>
      {!!x.note && (
        <View style={s.note}>
          <T v="small" style={{ fontFamily: font.medium }}>"{x.note}"</T>
          <T v="meta" tone="muted" style={{ marginTop: 2 }}>Coach {first}</T>
        </View>
      )}
      <View style={st.actions}>
        <Button title={locked ? 'Unlocks when your parent says yes' : x.windowStart ? 'Send the invite' : 'Pick a time and invite'} arrow onPress={onSend} disabled={locked} style={{ flexGrow: 1 }} />
        <Button title="Not now" kind="ghost" small onPress={onDismiss} />
      </View>
    </View>
  );
}
const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, minHeight: 48 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' },
});
const useS = makeStyles(c => ({
  card: { padding: 16, borderRadius: radius.xl, backgroundColor: c.card, borderWidth: 1.5, borderColor: c.green, marginBottom: 18 },
  badge: { width: 26, height: 26, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: c.soft },
}));
