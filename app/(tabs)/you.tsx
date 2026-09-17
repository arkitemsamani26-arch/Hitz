import React, { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Score } from '@/ui/Score';
import { Baseline, ServiceBox } from '@/ui/Court';
import { useToast } from '@/ui/Toast';
import { color, hit, space } from '@/theme/tokens';
import { api, demo } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { slotsOf, SLOTS } from '@/data/types';
import { pct } from '@/lib/format';

export default function You() {
  const router = useRouter();
  const toast = useToast();
  const { profile, setProfile, setSession, listMode, setListMode, refresh } = useSession();
  const { data: courts } = useAsync(() => api.courts(), []);
  const [editingAvail, setEditingAvail] = useState(false);
  if (!profile) return null;
  const looking = !!profile.lookingToHitUntil && new Date(profile.lookingToHitUntil) > new Date();
  const court = courts?.find(c => c.id === profile.homeCourtId)?.name ?? '—';
  const setLooking = async (v: boolean) => setProfile(await api.setLooking(v ? 7 : null));
  const toggleSlot = async (bit: number) => setProfile(await api.updateProfile({ availabilityMask: profile.availabilityMask ^ bit }));

  return (
    <Screen>
      <Centered>
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <T v="display" style={{ letterSpacing: -1.5 }}>{profile.displayName} {profile.lastInitial}.</T>
            <T v="small" tone="ink2">{court}{profile.band === 'minor' ? ' · Under 18' : ''}</T>
          </View>
          <Score value={profile.levelValue} size="score" verified={profile.levelSource === 'utr_verified'} />
        </View>

        <ServiceBox accent={looking} style={s.row}>
          <View style={{ flex: 1 }}>
            <T v="bodyM">Looking to hit this week</T>
            <T v="small" tone="ink2">Puts you at the top for players near your level. Expires on its own.</T>
          </View>
          <Switch value={looking} onValueChange={setLooking} trackColor={{ true: color.ball, false: color.court4 }} thumbColor={looking ? color.onBall : color.ink2} accessibilityLabel="Looking to hit this week" />
        </ServiceBox>

        {profile.band === 'minor' && (
          <ServiceBox style={s.row}>
            <View style={{ flex: 1 }}>
              <T v="bodyM">{profile.guardianVerified ? 'Parent linked' : profile.guardianPending ? 'Waiting on your parent' : 'No parent linked'}</T>
              <T v="small" tone="ink2">{profile.guardianVerified ? 'They approve each meetup. Nothing else changes.' : 'Reaching out unlocks once they say yes.'}</T>
            </View>
            {!profile.guardianVerified && !profile.guardianPending && <Button title="Add" small onPress={() => router.push('/onboarding/guardian')} />}
            {demo && !profile.guardianVerified && <Pill label="…" tone="faint" />}
          </ServiceBox>
        )}

        <View style={s.stats}>
          <View style={s.stat}><T v="h1">{profile.hitsConfirmed}</T><T v="micro" tone="ink3">Hits played</T></View>
          <View style={s.stat}><T v="h1">{pct(profile.responseRate) ?? '—'}</T><T v="micro" tone="ink3">Reply rate</T></View>
          <View style={s.stat}><T v="h1">{pct(profile.acceptRate) ?? '—'}</T><T v="micro" tone="ink3">Say yes</T></View>
        </View>
        <T v="small" tone="ink3" style={{ marginBottom: space.xl }}>Everyone sees these. Reply — even "no" — and they stay good.</T>

        <Baseline />
        <Tap onPress={() => setEditingAvail(e => !e)} style={s.line} accessibilityRole="button">
          <View style={{ flex: 1 }}><T v="bodyM">Usually free</T><T v="small" tone="ink2">{slotsOf(profile.availabilityMask).join(', ') || 'Not set'}</T></View>
          <T v="smallM" tone="cyan">{editingAvail ? 'Done' : 'Edit'}</T>
        </Tap>
        {editingAvail && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingBottom: space.lg }}>
            {SLOTS.map(sl => <Pill key={sl.bit} label={`${sl.label} ${sl.part.toLowerCase()}`} on={!!(profile.availabilityMask & sl.bit)} onPress={() => toggleSlot(sl.bit)} />)}
          </View>
        )}
        <Baseline />
        <View style={s.line}>
          <View style={{ flex: 1 }}><T v="bodyM">Browse as a list</T><T v="small" tone="ink2">Instead of the card stack.</T></View>
          <Switch value={listMode} onValueChange={setListMode} trackColor={{ true: color.ball, false: color.court4 }} thumbColor={listMode ? color.onBall : color.ink2} accessibilityLabel="Browse as a list" />
        </View>
        <Baseline />
        <Tap onPress={() => toast('Invite codes land with the next build.')} style={s.line} accessibilityRole="button">
          <View style={{ flex: 1 }}><T v="bodyM">Bring a hitting partner</T><T v="small" tone="ink2">Every code you hand out opens the courts sooner.</T></View>
          <T v="smallM" tone="cyan">Soon</T>
        </Tap>
        <Baseline />
        <Tap onPress={() => router.push('/guardian/link')} style={s.line} accessibilityRole="button">
          <View style={{ flex: 1 }}><T v="bodyM">What a parent sees</T><T v="small" tone="ink2">The page they get when you add them.</T></View>
          <T v="smallM" tone="cyan">View</T>
        </Tap>
        <Baseline />

        <View style={{ marginTop: space.xxl, gap: space.md }}>
          {demo && (() => { const d = demo; return (
            <ServiceBox style={{ padding: space.lg, gap: space.md }}>
              <T v="micro" tone="ink3">Demo controls</T>
              <View style={[s.line, { paddingVertical: 0 }]}>
                <View style={{ flex: 1 }}><T v="bodyM">Cohort open</T><T v="small" tone="ink2">Off shows the countdown state.</T></View>
                <Switch value={d.cohortOpen} onValueChange={v => { d.setCohortOpen(v); }} trackColor={{ true: color.ball, false: color.court4 }} thumbColor={d.cohortOpen ? color.onBall : color.ink2} />
              </View>
              {profile.band === 'minor' && <Button title="Open the parent's view" kind="line" onPress={async () => { d.switchToGuardian(); await refresh(); router.replace('/guardian'); }} />}
              <Button title="Reset demo" kind="ghost" onPress={async () => { await d.reset(); setSession(null); setProfile(null); router.replace('/onboarding/phone'); }} small />
            </ServiceBox>
          ); })()}
          <Button title="Sign out" kind="ghost" onPress={async () => { await api.signOut(); setSession(null); setProfile(null); router.replace('/onboarding/phone'); }} small />
        </View>
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg, marginTop: space.md, marginBottom: space.xl },
  row: { padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  stats: { flexDirection: 'row', marginTop: space.xl, marginBottom: space.sm },
  stat: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: hit.row, paddingVertical: space.md },
});
