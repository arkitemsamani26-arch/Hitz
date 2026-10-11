// The parent's view. What needs a yes, what is on the calendar, and the link itself.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Pill } from '@/ui/Pill';
import { Icon } from '@/ui/Icon';
import { Loading } from '@/ui/Loading';
import { Avatar } from '@/ui/Avatar';
import { Wordmark } from '@/ui/Wordmark';
import { OptionSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api, demo } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { dateLong, rangeText, levelBig } from '@/lib/format';
import { legal } from '@/lib/links';
import * as WebBrowser from 'expo-web-browser';

export default function GuardianHome() {
  const router = useRouter();
  const t = useTheme();
  const s = useS();
  const { tick, refresh, setSession, setProfile } = useSession();
  const toast = useToast();
  const { data: kids, loading } = useAsync(() => api.guardianChildren(), [tick]);
  const links = useAsync(() => api.guardianLinks(), [tick]);
  const [revoking, setRevoking] = useState<{ id: string; childName: string } | null>(null);
  const many = (kids?.length ?? 0) > 1;
  return (
    <Screen onRefresh={refresh}>
      <Centered>
        <View style={{ marginTop: space.md, marginBottom: space.lg }}>
          <Wordmark />
          <T v="eyebrow" tone="muted" style={{ marginTop: space.lg }}>For parents</T>
          <T v="display" style={{ marginTop: 12 }}>They find the hit.{'\n'}<T v="display" italic>You approve the meeting.</T></T>
        </View>
        {loading && !kids ? <Loading /> : (kids ?? []).map(k => (
          <View key={k.profile.id} style={{ marginBottom: space.xl }}>
            {/* Which child this is for, when there is more than one. */}
            <View style={st.kid}>
              <Avatar name={k.profile.displayName} lastInitial={k.profile.lastInitial} photo={k.profile.photoUrl} size={36} shape="round" />
              <T v="h2" style={{ flex: 1 }}>{k.profile.displayName}{many ? "'s account" : ''}</T>
              <Pill label={`${levelBig(k.profile.levelValue)} UTR`} />
            </View>
            {k.profile.photoPendingUrl && (
              <Card stripe style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Avatar name={k.profile.displayName} photo={k.profile.photoPendingUrl} size={52} />
                <View style={{ flex: 1 }}><T v="smallM">{k.profile.displayName} added a photo</T><T v="meta" tone="muted">Nobody sees it until you say so.</T></View>
                <View style={{ gap: space.xs }}>
                  <Button title="Approve" small onPress={async () => { await api.guardianApprovePhoto(k.profile.id, true); toast('Photo approved.'); await refresh(); }} />
                  <Button title="Remove" kind="line" small onPress={async () => { await api.guardianApprovePhoto(k.profile.id, false); toast('Photo removed.'); await refresh(); }} />
                </View>
              </Card>
            )}
            <T v="micro" tone="muted" style={st.k}>Needs your OK</T>
            {k.pendingApprovals.length === 0
              ? <Card><T v="small" tone="muted">Nothing waiting. You'll get a text when something is.</T></Card>
              : k.pendingApprovals.map(a => (
                <Tap key={a.hitId} onPress={() => router.push(`/guardian/approve/${a.hitId}`)} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={`Review the hit with ${a.request.other.displayName}`}>
                  <Card stripe style={st.card}>
                    <View style={{ flex: 1 }}>
                      <T v="smallM">{k.profile.displayName} + {a.request.other.displayName} {a.request.other.lastInitial}.</T>
                      <T v="meta" tone="muted">{dateLong(new Date(a.request.windowStart))}, {rangeText(new Date(a.request.windowStart), new Date(a.request.windowEnd))}</T>
                      <T v="meta" tone="muted">{a.request.courtName}</T>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><T v="smallM" tone="green">Review</T><Icon name="chevron-right" size={15} color={t.green} /></View>
                  </Card>
                </Tap>
              ))}
            <T v="micro" tone="muted" style={st.k}>On the calendar</T>
            <Card style={{ paddingVertical: 4 }}>
              {k.upcoming.length === 0 ? <T v="small" tone="muted" style={{ paddingVertical: space.md }}>No confirmed hits yet.</T> : k.upcoming.map((r, i) => (
                <Tap key={r.id} onPress={() => router.push(`/guardian/approve/${r.id}`)} style={[st.row, i > 0 && s.rule]} accessibilityRole="button">
                  <View style={{ flex: 1 }}><T v="smallM">with {r.other.displayName} {r.other.lastInitial}.</T><T v="meta" tone="muted">{dateLong(new Date(r.windowStart))}, {rangeText(new Date(r.windowStart), new Date(r.windowEnd))} · {r.courtName}</T></View>
                  <Pill label="Approved" icon="check" />
                </Tap>
              ))}
            </Card>
          </View>
        ))}
        {(links.data ?? []).map(l => (
          <Card key={l.id} style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}><T v="smallM">Linked to {l.childName}</T><T v="meta" tone="muted">Pause or remove it any time. Their meetups stop the moment you do.</T></View>
            <Button title="Remove" kind="danger" small onPress={() => setRevoking(l)} />
          </Card>
        ))}
        <OptionSheet open={!!revoking} onClose={() => setRevoking(null)} title={`Remove your link to ${revoking?.childName ?? ''}?`} options={[
          { label: 'Remove the link', sub: 'Every open hit is cancelled. They can invite you again later.', danger: true,
            onPress: async () => { if (!revoking) return; try { await api.guardianRevoke(revoking.id); await refresh(); toast('Removed.'); } catch (e: any) { toast(e.message); } } },
          { label: 'Keep it', onPress: () => {} },
        ]} />
        <T v="meta" tone="muted" style={{ lineHeight: 18 }}>You see every invitation and every message on {kids?.[0]?.profile.displayName ?? 'your kid'}'s account, in full. No adult can find or contact an under-18 here. The database enforces it.</T>

        {/* The parent's own account. They signed in with a phone number too, and need the
            same way out, the same help and the same policies as anyone else. */}
        <T v="micro" tone="muted" style={[st.k, { marginTop: space.xl }]}>Your account</T>
        <Card style={{ paddingVertical: 2 }}>
          <Tap onPress={() => router.push('/guardian/link')} style={st.row} accessibilityRole="button">
            <View style={{ flex: 1 }}><T v="smallM">How this works</T><T v="meta" tone="muted">What you control and what you see.</T></View>
            <Icon name="chevron-right" size={15} color={t.muted} />
          </Tap>
          {legal && (() => { const L = legal; return (
            <>
              <Tap onPress={() => void WebBrowser.openBrowserAsync(L.support)} style={[st.row, s.rule]} accessibilityRole="link">
                <View style={{ flex: 1 }}><T v="smallM">Help</T><T v="meta" tone="muted">Reach a person. Safety reports same day.</T></View>
                <Icon name="arrow-up-right" size={15} color={t.muted} />
              </Tap>
              <Tap onPress={() => void WebBrowser.openBrowserAsync(L.privacy)} style={[st.row, s.rule]} accessibilityRole="link">
                <View style={{ flex: 1 }}><T v="smallM">Privacy policy</T><T v="meta" tone="muted">Including what we keep about you as a parent.</T></View>
                <Icon name="arrow-up-right" size={15} color={t.muted} />
              </Tap>
              <Tap onPress={() => void WebBrowser.openBrowserAsync(L.terms)} style={[st.row, s.rule]} accessibilityRole="link">
                <View style={{ flex: 1 }}><T v="smallM">Terms of use</T><T v="meta" tone="muted">The rules for everyone on Hits.</T></View>
                <Icon name="arrow-up-right" size={15} color={t.muted} />
              </Tap>
            </>
          ); })()}
        </Card>
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          {demo && (() => { const d = demo; return (
            <Button title="Back to the player view (demo)" kind="line" onPress={async () => { d.switchToPlayer(); await refresh(); router.replace('/(tabs)'); }} />
          ); })()}
          <Button title="Sign out" kind="ghost" icon="log-out" small style={{ alignSelf: 'flex-start' }} onPress={async () => { await api.signOut(); setSession(null); setProfile(null); router.replace('/onboarding/phone'); }} />
          <Tap onPress={() => router.push('/delete-account')} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }} accessibilityRole="button">
            <T v="small" tone="danger">Delete my account</T>
          </Tap>
        </View>
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  kid: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  k: { marginTop: space.md, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 12, gap: space.md },
});
const useS = makeStyles(c => ({ rule: { borderTopWidth: 1, borderTopColor: c.line } }));
