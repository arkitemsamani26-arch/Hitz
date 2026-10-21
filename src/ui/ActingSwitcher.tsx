// "Who is using Hits right now?" A parent who runs a child's account switches between
// themselves and each child. While switched, this says so wherever it shows, because a
// message sent from here is sent as the child.
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Avatar } from '@/ui/Avatar';
import { Icon } from '@/ui/Icon';
import { OptionSheet } from '@/ui/Sheet';
import { hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';

export function ActingSwitcher({ onlyWhenActing = false }: { onlyWhenActing?: boolean }) {
  const router = useRouter();
  const t = useTheme();
  const s = useS();
  const { acting, setActing, profile, session, tick } = useSession();
  const kids = useAsync(() => api.runChildren().catch(() => []), [tick, session?.userId]);
  const [open, setOpen] = useState(false);
  const list = kids.data ?? [];
  if (!acting && (onlyWhenActing || list.length === 0)) return null;

  const switchTo = async (id: string | null) => {
    await setActing(id);
    if (id) router.replace('/(tabs)');
    else if (session?.isGuardian) router.replace('/guardian');
  };
  const me = session?.isGuardian ? 'Me, and the family view' : 'Me';

  return (
    <>
      {acting ? (
        <Tap onPress={() => setOpen(true)} style={s.bar} scaleTo={0.99} accessibilityRole="button"
          accessibilityLabel={`You're using Hits as ${profile?.displayName ?? 'your child'}. Switch.`}>
          <Avatar name={profile?.displayName ?? '?'} lastInitial={profile?.lastInitial ?? null} photo={profile?.photoUrl ?? null} size={28} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="smallM" tone="greenText" numberOfLines={1}>Using Hits as {profile?.displayName ?? 'your child'}</T>
            <T v="meta" tone="greenText" numberOfLines={1}>You run this account. Messages go as them.</T>
          </View>
          <View style={s.switch}><T v="meta" style={{ fontWeight: '600' }}>Switch</T><Icon name="chevron-right" size={13} color={t.ink} /></View>
        </Tap>
      ) : (
        <View style={s.row} accessibilityLabel="Use Hits as one of your children">
          <T v="meta" tone="muted">Use Hits as</T>
          {list.map(k => (
            <Tap key={k.id} onPress={() => void switchTo(k.id)} style={s.chip} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`Use Hits as ${k.displayName}`}>
              <Avatar name={k.displayName} lastInitial={k.lastInitial} photo={k.photoUrl} size={24} />
              <T v="smallM">{k.displayName}</T>
            </Tap>
          ))}
        </View>
      )}
      <OptionSheet open={open} onClose={() => setOpen(false)} title="Use Hits as"
        options={[
          { label: me, sub: 'Your own account', onPress: () => void switchTo(null) },
          ...list.filter(k => k.id !== acting).map(k => ({ label: k.displayName, sub: `Age ${k.age} · you run this account`, onPress: () => void switchTo(k.id) })),
        ]} />
    </>
  );
}

const useS = makeStyles(c => ({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.lg, backgroundColor: c.green, minHeight: hit.min, marginBottom: space.md },
  switch: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: c.card },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: space.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 4, paddingRight: 12, borderRadius: 999, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, minHeight: hit.min },
}));
