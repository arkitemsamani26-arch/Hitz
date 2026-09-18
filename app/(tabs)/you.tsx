import React, { useState } from 'react';
import { Share, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Sheet } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Field } from '@/ui/Field';
import { Score } from '@/ui/Score';
import { MemberCard } from '@/ui/MemberCard';
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
  const { profile, setProfile, setSession, listMode, setListMode, refresh, tick } = useSession();
  const { data: courts } = useAsync(() => api.courts(), []);
  const rosters = useAsync(() => api.myRosters(), [tick]);
  const [editingAvail, setEditingAvail] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  if (!profile) return null;
  const looking = !!profile.lookingToHitUntil && new Date(profile.lookingToHitUntil) > new Date();
  const court = courts?.find(c => c.id === profile.homeCourtId)?.name ?? '—';
  const setLooking = async (v: boolean) => setProfile(await api.setLooking(v ? 7 : null));
  const toggleSlot = async (bit: number) => setProfile(await api.updateProfile({ availabilityMask: profile.availabilityMask ^ bit }));
  const createTeam = async () => {
    if (teamName.trim().length < 2) return;
    setCreating(true);
    try { const r = await api.createRoster(teamName.trim(), 20); setTeamName(''); await rosters.reload(); void Share.share({ message: `Join ${r.name} on Hits — code ${r.code}. Find hitting partners at your level in Palo Alto.` }).catch(() => {}); }
    catch (e: any) { toast(e.message); } finally { setCreating(false); }
  };

  return (
    <Screen sky={150}>
      <Centered>
        <MemberCard name={`${profile.displayName} ${profile.lastInitial ?? ''}.`} level={profile.levelValue} verified={profile.levelSource === 'utr_verified'} court={court} roster={profile.rosterName} minor={profile.band === 'minor'} />

        <Sheet accent={looking} style={s.row}>
          <View style={{ flex: 1 }}>
            <T v="bodyM">Looking to hit this week</T>
            <T v="small" tone="ink2">Puts you at the net for players near your level. Expires on its own.</T>
          </View>
          <Switch value={looking} onValueChange={setLooking} trackColor={{ true: color.court, false: color.paper3 }} thumbColor={color.paper} accessibilityLabel="Looking to hit this week" />
        </Sheet>

        {profile.band === 'minor' && (
          <Sheet style={s.row}>
            <View style={{ flex: 1 }}>
              <T v="bodyM">{profile.guardianVerified ? 'Parent linked' : profile.guardianOpenedAt ? 'Your parent opened the link' : profile.guardianPending ? 'Sent to your parent' : 'No parent linked'}</T>
              <T v="small" tone="ink2">{profile.guardianVerified ? 'They approve each meetup. Nothing else changes.' : 'Reaching out unlocks once they say yes.'}</T>
            </View>
            {!profile.guardianVerified && !profile.guardianPending && <Button title="Add" small onPress={() => router.push('/onboarding/guardian')} />}
          </Sheet>
        )}

        <Sheet style={{ marginBottom: space.md }}>
          <View style={s.stats}>
            <View style={s.stat}><T v="h1" tone="court">{profile.hitsConfirmed}</T><T v="micro" tone="ink3">Hits played</T></View>
            <View style={s.stat}><T v="h1" tone="court">{pct(profile.responseRate) ?? '—'}</T><T v="micro" tone="ink3">Reply rate</T></View>
            <View style={s.stat}><T v="h1" tone="court">{pct(profile.acceptRate) ?? '—'}</T><T v="micro" tone="ink3">Say yes</T></View>
          </View>
          <T v="small" tone="ink3" style={{ marginTop: space.sm }}>Everyone sees these. Reply — even "no" — and they stay good.</T>
        </Sheet>

        {/* Rosters: one code brings a whole team. */}
        <Sheet style={{ marginBottom: space.md, gap: space.sm }}>
          <T v="h2">Bring your team</T>
          <T v="small" tone="ink2">Make a code for your team, academy group or club ladder. Everyone who joins with it counts toward opening the courts.</T>
          {(rosters.data ?? []).map(r => (
            <Tap key={r.id} onPress={() => void Share.share({ message: `Join ${r.name} on Hits — code ${r.code}.` }).catch(() => {})} style={s.roster} accessibilityRole="button">
              <View style={{ flex: 1 }}><T v="bodyM">{r.name}</T><T v="small" tone="ink2">{r.joined} of {r.cap} joined</T></View>
              <Pill label={r.code} tone="ball" />
            </Tap>
          ))}
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><Field value={teamName} onChangeText={setTeamName} placeholder="Paly Girls Varsity" maxLength={40} /></View>
            <Button title="Make a code" small onPress={createTeam} loading={creating} disabled={teamName.trim().length < 2} />
          </View>
        </Sheet>

        <Sheet style={{ paddingVertical: 4, marginBottom: space.md }}>
          <Tap onPress={() => setEditingAvail(e => !e)} style={s.line} accessibilityRole="button">
            <View style={{ flex: 1 }}><T v="bodyM">Usually free</T><T v="small" tone="ink2">{slotsOf(profile.availabilityMask).join(', ') || 'Not set'}</T></View>
            <T v="smallM" tone="court">{editingAvail ? 'Done' : 'Edit'}</T>
          </Tap>
          {editingAvail && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingBottom: space.lg }}>
              {SLOTS.map(sl => <Pill key={sl.bit} label={`${sl.label} ${sl.part.toLowerCase()}`} on={!!(profile.availabilityMask & sl.bit)} onPress={() => toggleSlot(sl.bit)} />)}
            </View>
          )}
          <View style={[s.line, { borderTopWidth: 1, borderTopColor: color.hair }]}>
            <View style={{ flex: 1 }}><T v="bodyM">Browse on the court</T><T v="small" tone="ink2">Players placed by level and distance, instead of the list.</T></View>
            <Switch value={!listMode} onValueChange={v => setListMode(!v)} trackColor={{ true: color.court, false: color.paper3 }} thumbColor={color.paper} accessibilityLabel="Browse on the court" />
          </View>
          <Tap onPress={() => router.push('/guardian/link')} style={[s.line, { borderTopWidth: 1, borderTopColor: color.hair }]} accessibilityRole="button">
            <View style={{ flex: 1 }}><T v="bodyM">What a parent sees</T><T v="small" tone="ink2">The page they get when you add them.</T></View>
            <T v="smallM" tone="court">View</T>
          </Tap>
        </Sheet>

        <View style={{ gap: space.md }}>
          {demo && (() => { const d = demo; return (
            <Sheet style={{ gap: space.md }}>
              <T v="micro" tone="ink3">Demo controls</T>
              <View style={[s.line, { paddingVertical: 0 }]}>
                <View style={{ flex: 1 }}><T v="bodyM">Cohort open</T><T v="small" tone="ink2">Off shows the countdown state.</T></View>
                <Switch value={d.cohortOpen} onValueChange={v => { d.setCohortOpen(v); }} trackColor={{ true: color.court, false: color.paper3 }} thumbColor={color.paper} />
              </View>
              {profile.band === 'minor' && <Button title="Open the parent's view" kind="line" onPress={async () => { d.switchToGuardian(); await refresh(); router.replace('/guardian'); }} />}
              <Button title="Reset demo" kind="ghost" onPress={async () => { await d.reset(); setSession(null); setProfile(null); router.replace('/onboarding/phone'); }} small />
            </Sheet>
          ); })()}
          <Button title="Sign out" kind="ghost" onPress={async () => { await api.signOut(); setSession(null); setProfile(null); router.replace('/onboarding/phone'); }} small />
        </View>
      </Centered>
    </Screen>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, gap: 2 },
  roster: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, borderTopWidth: 1, borderTopColor: color.hair, paddingVertical: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: hit.row, paddingVertical: space.md },
});
