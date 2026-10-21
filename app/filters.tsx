// Who you see. Distance, level band, when you are free, and whether to show only people
// who said they want to hit this week. Then the Plus filters: playing style, hand, reply
// rate, indoor courts, singles or doubles; and saved searches, which alert you when a new
// player who fits joins.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useToast } from '@/ui/Toast';
import { useGoBack } from '@/lib/nav';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Pill } from '@/ui/Pill';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Icon } from '@/ui/Icon';
import { Header } from '@/ui/Header';
import { hit, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { useFilters, defaultsFor } from '@/store/filters';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { AvailabilityGrid } from '@/ui/Availability';
import { api } from '@/data';
import { HAND_LABEL, PLAY_STYLE_LABEL, isPlusError, plainMessage } from '@/lib/plus';
import type { Handedness, PlayStyle } from '@/data/types';

// Bay Area: 10 is a normal drive, 25 reaches San Jose.
const RADII = [5, 10, 15, 25];
const BANDS: { label: string; d: number | null }[] = [{ label: '±0.5', d: 0.5 }, { label: '±1', d: 1 }, { label: '±2', d: 2 }, { label: 'Any level', d: null }];
// Juniors: how close in age. A parent's rule, when there is one, sits underneath whatever
// is chosen here; this can narrow it, never widen past it.
const AGES: { label: string; gap: number | null }[] = [{ label: 'Within a year', gap: 1 }, { label: 'Within 2 years', gap: 2 }, { label: 'Within 3 years', gap: 3 }, { label: 'Any age', gap: null }];
const STYLES = Object.keys(PLAY_STYLE_LABEL) as PlayStyle[];
const HANDS = Object.keys(HAND_LABEL) as Handedness[];
const REPLY: { label: string; v: number | null }[] = [{ label: 'Anyone', v: null }, { label: 'Replies 70%+', v: 0.7 }, { label: 'Replies 90%+', v: 0.9 }];

export default function Filters() {
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const toast = useToast();
  const router = useRouter();
  const goBack = useGoBack();
  const t = useTheme();
  const s = useS();
  const { filters, set } = useFilters();
  const { profile, tick } = useSession();
  const [f, setF] = useState(filters);
  const plus = !!profile?.plus;
  const searches = useAsync(() => (plus ? api.savedSearches() : Promise.resolve([])), [plus, tick]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const my = profile?.levelValue ?? 6;
  // Read and write at the same precision, or the chip you just tapped deselects itself.
  const band = f.levelLo == null ? null : +(my - f.levelLo).toFixed(2);
  const setBand = (d: number | null) => setF(x => ({ ...x, levelLo: d == null ? null : +(my - d).toFixed(2), levelHi: d == null ? null : +(my + d).toFixed(2) }));
  // A push about a saved search lands here with its id, and the search loads itself.
  useEffect(() => {
    const x = saved ? (searches.data ?? []).find(q => q.id === saved) : null;
    if (x) setF(q => ({ ...q, ...x.filters }));
  }, [saved, searches.data]);
  // The Plus filters: on the free plan, every chip is the way to the paywall.
  const locked = () => router.push('/plus?why=filters');
  const plusChip = (label: string, on: boolean, onPress: () => void) => <Pill key={label} label={label} on={plus && on} onPress={plus ? onPress : locked} />;

  const save = async () => {
    setSaving(true);
    try {
      await api.saveSearch(name.trim() || 'My search', { ...f, onlyLooking: false });
      await searches.reload(); setNaming(false); setName('');
      toast('Saved. You get a push when a new player who fits joins.');
    } catch (e: any) { if (isPlusError(e)) router.push('/plus?why=searches'); else toast(plainMessage(e) || "Couldn't save that."); }
    finally { setSaving(false); }
  };

  return (
    <Screen bottom={<Centered><View style={{ flexDirection: 'row', gap: space.sm }}>
      <Button title="Reset" kind="line" onPress={() => { setF(defaultsFor(profile?.band)); toast('Filters cleared.'); }} />
      <Button title="Show players" arrow onPress={() => { set(f); goBack(); }} style={{ flex: 1 }} />
    </View></Centered>}>
      <Centered>
        <Header />
        <T v="eyebrow" tone="muted">Who you see</T>
        <T v="display" style={{ marginTop: 12, marginBottom: 24 }}>Your kind{'\n'}<T v="display" italic>of player.</T></T>
        <Card style={{ gap: space.sm }}>
          <T v="micro" tone="muted">Distance</T>
          <View style={st.chips}>
            {RADII.map(r => <Pill key={r} label={`${r} mi`} on={f.radiusMi === r} onPress={() => setF(x => ({ ...x, radiusMi: r }))} />)}
          </View>
          <T v="micro" tone="muted" style={{ marginTop: space.lg }}>Level, around your {my.toFixed(1)}</T>
          <View style={st.chips}>
            {BANDS.map(b => <Pill key={b.label} label={b.label} on={band === b.d} onPress={() => setBand(b.d)} />)}
          </View>
          <T v="meta" tone="muted">{band == null ? 'Everyone in range, whatever their level.' : `UTR ${(my - band).toFixed(1)} to ${(my + band).toFixed(1)}.`}</T>
          <T v="micro" tone="muted" style={{ marginTop: space.lg }}>Free when</T>
          <View style={{ marginTop: space.xs }}>
            <AvailabilityGrid mask={f.availability} onToggle={bit => setF(x => ({ ...x, availability: x.availability ^ bit }))} />
          </View>
          {profile?.band === 'minor' && (
            <>
              <T v="micro" tone="muted" style={{ marginTop: space.lg }}>Age{profile.age != null ? `, around your ${profile.age}` : ''}</T>
              <View style={st.chips}>
                {AGES.map(a => <Pill key={a.label} label={a.label} on={f.ageGap === a.gap} onPress={() => setF(x => ({ ...x, ageGap: a.gap }))} />)}
              </View>
              <T v="meta" tone="muted">
                {profile.maxPartnerAgeGap ? `Your parent set within ${profile.maxPartnerAgeGap} ${profile.maxPartnerAgeGap === 1 ? 'year' : 'years'}. That always applies. ` : ''}Only players under 18, always.
              </T>
            </>
          )}
          <View style={{ marginTop: space.lg }}><Pill label="Only players looking to hit this week" on={f.onlyLooking} onPress={() => setF(x => ({ ...x, onlyLooking: !x.onlyLooking }))} style={{ alignSelf: 'flex-start' }} /></View>
        </Card>

        {/* The Plus filters. Shown to everyone; on the free plan each chip opens the paywall. */}
        <Tap onPress={plus ? undefined : locked} disabled={plus} style={st.plusHead} accessibilityRole={plus ? undefined : 'button'} accessibilityLabel={plus ? undefined : 'More filters, part of Plus. See Plus.'}>
          <T v="micro" tone="muted">More filters{plus ? '' : ' · Plus'}</T>
          {!plus && <Icon name="lock" size={13} color={t.muted} />}
        </Tap>
        <Card style={{ gap: space.sm }}>
          <T v="micro" tone="muted">Playing style</T>
          <View style={st.chips}>
            {STYLES.map(x => plusChip(PLAY_STYLE_LABEL[x], f.playStyle === x, () => setF(q => ({ ...q, playStyle: q.playStyle === x ? null : x }))))}
          </View>
          <T v="micro" tone="muted" style={{ marginTop: space.lg }}>Hand</T>
          <View style={st.chips}>
            {HANDS.map(x => plusChip(HAND_LABEL[x], f.handedness === x, () => setF(q => ({ ...q, handedness: q.handedness === x ? null : x }))))}
          </View>
          <T v="micro" tone="muted" style={{ marginTop: space.lg }}>Reliable</T>
          <View style={st.chips}>
            {REPLY.map(x => plusChip(x.label, (f.minReplyRate ?? null) === x.v, () => setF(q => ({ ...q, minReplyRate: x.v }))))}
          </View>
          <T v="micro" tone="muted" style={{ marginTop: space.lg }}>Court and game</T>
          <View style={st.chips}>
            {plusChip('Indoor courts only', !!f.indoorOnly, () => setF(q => ({ ...q, indoorOnly: !q.indoorOnly })))}
            {plusChip('Singles players', f.format === 'singles', () => setF(q => ({ ...q, format: q.format === 'singles' ? null : 'singles' })))}
            {plusChip('Doubles players', f.format === 'doubles', () => setF(q => ({ ...q, format: q.format === 'doubles' ? null : 'doubles' })))}
          </View>
          {!plus && <T v="meta" tone="muted" style={{ marginTop: space.xs }}>Part of Plus, $4.99 a month, with unlimited invitations, auto-match and your stats.</T>}
        </Card>

        <T v="micro" tone="muted" style={st.k}>Saved searches{plus ? '' : ' · Plus'}</T>
        <Card style={{ gap: space.sm }}>
          {(searches.data ?? []).map(x => (
            <View key={x.id} style={s.saved}>
              <Icon name="bell" size={15} color={t.ink} />
              <View style={{ flex: 1, minWidth: 0 }}><T v="smallM" numberOfLines={1}>{x.name}</T><T v="meta" tone="muted">{x.lastRunAt ? 'Checked daily' : 'Alerts from tomorrow'}</T></View>
              <Button title="Use" small kind="line" onPress={() => setF(q => ({ ...q, ...x.filters }))} />
              <Button title="Delete" small kind="ghost" onPress={async () => { try { await api.deleteSearch(x.id); await searches.reload(); } catch (e: any) { toast(e?.message ?? "Couldn't delete."); } }} />
            </View>
          ))}
          {!plus ? (
            <>
              <T v="small" tone="muted">Save these filters and get a push when a new player who fits joins near you.</T>
              <Button title="See Plus" small kind="line" onPress={() => router.push('/plus?why=searches')} style={{ alignSelf: 'flex-start' }} />
            </>
          ) : naming ? (
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}><Field label="Name it" value={name} onChangeText={setName} placeholder="Lefties near me" maxLength={40} accessibilityLabel="Name for this search" /></View>
              <Button title="Save" small onPress={save} loading={saving} />
            </View>
          ) : (
            <>
              {(searches.data ?? []).length === 0 && <T v="small" tone="muted">Save these filters and get a push when a new player who fits joins near you. Up to five.</T>}
              <Button title="Save these filters" small kind="line" icon="plus" onPress={() => setNaming(true)} disabled={(searches.data ?? []).length >= 5} style={{ alignSelf: 'flex-start' }} />
            </>
          )}
        </Card>
        <View style={{ height: space.lg }} />
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  plusHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24, marginBottom: 10, minHeight: 24 },
  k: { marginTop: 24, marginBottom: 10 },
});
const useS = makeStyles(c => ({
  saved: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: hit.min, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: c.line },
}));
