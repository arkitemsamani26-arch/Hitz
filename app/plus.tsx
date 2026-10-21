// Hits Plus. One plan, $4.99 a month, and the one screen that sells it. Opened by hand from
// Profile, and by every limit the free plan has: the fourth invitation, a locked filter,
// "see everyone", stats, auto-match. A junior never sees a price here; they ask their parent,
// whose one plan covers every child they manage.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Screen, Centered, Card } from '@/ui/Screen';
import { T } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Button } from '@/ui/Button';
import { Header } from '@/ui/Header';
import { Icon } from '@/ui/Icon';
import { Loading } from '@/ui/Loading';
import { useToast } from '@/ui/Toast';
import { fixed, font, hit, radius, space } from '@/theme/tokens';
import { makeStyles, useTheme } from '@/theme/theme';
import { api, demo } from '@/data';
import { useSession } from '@/store/session';
import { useAsync } from '@/store/useAsync';
import { legal } from '@/lib/links';
import { haptic } from '@/lib/haptics';
import { dateLong } from '@/lib/format';
import { PLUS_BENEFITS, PLUS_PERIOD, PLUS_PRICE, PLUS_WHY, type PlusWhy } from '@/lib/plus';
import { configurePurchases, manageSubscription, purchasePlus, purchasesAvailable, restorePurchases } from '@/lib/purchases';

// Which benefit each limit lights up on the list.
const HIGHLIGHT: Record<PlusWhy, string> = {
  invites: 'Unlimited invitations', filters: 'Every filter', card: 'A fuller card', stats: 'Your stats',
  notes: 'Private partner notes', searches: 'Saved searches with alerts', automatch: 'Auto-match', looking: 'Everyone free this week',
};

export default function Plus() {
  const { why } = useLocalSearchParams<{ why?: PlusWhy }>();
  const router = useRouter();
  const toast = useToast();
  const t = useTheme();
  const s = useS();
  const { profile, session, refresh, tick } = useSession();
  const status = useAsync(() => api.myPlus(), [tick]);
  const [busy, setBusy] = useState<null | 'buy' | 'restore' | 'ask'>(null);
  const minor = profile?.band === 'minor';
  const plus = status.data?.plus ?? profile?.plus ?? false;
  const reason = why && PLUS_WHY[why] ? PLUS_WHY[why] : null;

  useEffect(() => { if (session?.userId) void configurePurchases(session.userId); }, [session?.userId]);

  const buy = async () => {
    setBusy('buy');
    try {
      await api.beginPurchase();
      const r = await purchasePlus();
      if (r === 'ok') { haptic.confirmed(); await refresh(); await status.reload(); toast('Welcome to Plus.'); }
      else if (r === 'cancelled') { /* their call */ }
      else if (r === 'unavailable') toast(api.mode === 'demo' ? 'Demo mode: use the switch below.' : 'Plus is not for sale here yet. Try the app on your phone.');
      else toast("The store didn't finish. Nothing was charged.");
    } catch (e: any) { haptic.warn(); toast(e?.message ?? "That didn't go through."); }
    finally { setBusy(null); }
  };
  const restore = async () => {
    setBusy('restore');
    try {
      const ok = await restorePurchases();
      await refresh(); await status.reload();
      toast(ok ? 'Plus restored.' : 'No subscription found for this account.');
    } finally { setBusy(null); }
  };
  const ask = async () => {
    setBusy('ask');
    try { await api.requestPlusFromParent(); haptic.sent(); toast('Asked your parent. They get a notification.'); }
    catch (e: any) { haptic.warn(); toast(e?.message ?? "That didn't go through."); }
    finally { setBusy(null); }
  };

  const L = legal;
  const Legal = L ? (
    <T v="meta" tone="muted" style={{ marginTop: space.md, lineHeight: 18 }}>
      {PLUS_PRICE} a {PLUS_PERIOD}, billed by the App Store or Google Play, renews until you cancel in your store account.{' '}
      <T v="meta" tone="green" onPress={() => void WebBrowser.openBrowserAsync(L.terms)} accessibilityRole="link">Terms of use</T> · <T v="meta" tone="green" onPress={() => void WebBrowser.openBrowserAsync(L.privacy)} accessibilityRole="link">Privacy policy</T>
    </T>
  ) : (
    <T v="meta" tone="muted" style={{ marginTop: space.md, lineHeight: 18 }}>{PLUS_PRICE} a {PLUS_PERIOD}, billed by the App Store or Google Play, renews until you cancel in your store account.</T>
  );

  return (
    <Screen bottom={plus || minor ? undefined : (
      <Centered>
        <Button title={purchasesAvailable() || api.mode === 'demo' ? `Get Plus · ${PLUS_PRICE} a ${PLUS_PERIOD}` : 'Not available yet'} arrow onPress={buy} loading={busy === 'buy'} disabled={!purchasesAvailable() && api.mode !== 'demo'} />
        <Button title="Restore purchases" kind="ghost" small onPress={restore} loading={busy === 'restore'} style={{ alignSelf: 'center', marginTop: space.xs }} />
      </Centered>
    )}>
      <Centered>
        <Header backLabel="Back" fallback="/(tabs)/you" />
        <View style={st.mark}><View style={s.badge}><T v="micro" style={st.badgeText}>Plus</T></View></View>
        <T v="eyebrow" tone="muted">Hits Plus</T>
        <T v="display" style={st.h} accessibilityRole="header">
          {plus ? <>You have{'\n'}<T v="display" italic>Plus.</T></> : minor ? <>More hits.{'\n'}<T v="display" italic>Ask your parent.</T></> : <>More hits,{'\n'}<T v="display" italic>less waiting.</T></>}
        </T>

        {reason && !plus && (
          <View style={s.why}>
            <Icon name="lock" size={15} color={t.ink} />
            <T v="small" style={{ flex: 1 }}>{reason}</T>
          </View>
        )}

        {status.loading && !status.data ? <Loading /> : plus ? (
          <Card style={{ gap: space.sm }}>
            <T v="smallM">{status.data?.viaParent ? 'Through your parent' : status.data?.source === 'promo' ? 'On us' : 'Subscribed'}</T>
            <T v="small" tone="muted">
              {status.data?.viaParent ? 'Your parent\'s Plus covers you. Everything below is on.'
                : status.data?.plusUntil ? `Renews ${dateLong(new Date(status.data.plusUntil))}. Cancel any time in your store account; you keep Plus until then.` : 'Everything below is on.'}
            </T>
            {!status.data?.viaParent && status.data?.source !== 'promo' && api.mode !== 'demo' && (
              <Button title="Manage subscription" kind="line" small onPress={async () => { if (!(await manageSubscription())) toast("Couldn't open your store account."); }} style={{ alignSelf: 'flex-start' }} />
            )}
          </Card>
        ) : minor ? (
          <Card style={{ gap: space.sm }}>
            <T v="smallM">Your parent buys Plus</T>
            <T v="small" tone="muted">One plan on your parent's account covers you and any brothers or sisters on Hits. Tap below and they get a notification{profile?.guardianVerified ? '' : ' once they have linked to your account'}.</T>
            <Button title="Ask your parent" arrow onPress={ask} loading={busy === 'ask'} disabled={!profile?.guardianVerified} />
          </Card>
        ) : (
          <T v="small" tone="muted" style={{ marginBottom: space.md, lineHeight: 21 }}>
            Free Hits gets you a hit every week. Plus is for the weeks you want three.
          </T>
        )}

        <T v="micro" tone="muted" style={st.k}>What Plus does</T>
        <Card style={{ paddingVertical: 4 }}>
          {PLUS_BENEFITS.map((b, i) => (
            <View key={b.title} style={[st.row, i > 0 && s.rule]}>
              <View style={[s.icon, why && HIGHLIGHT[why] === b.title && s.iconOn]}>
                <Icon name={b.icon} size={17} color={t.ink} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T v="smallM">{b.title}</T>
                <T v="meta" tone="muted">{b.sub}</T>
              </View>
            </View>
          ))}
        </Card>

        <T v="micro" tone="muted" style={st.k}>What stays free</T>
        <Card style={{ gap: 6 }}>
          <T v="small" tone="muted" style={{ lineHeight: 19 }}>
            Finding players, sending and answering invitations, every conversation, sharing your number, tournaments and doubles partners, the family view, parent approvals, blocking and reporting, and the coach tools. Nobody pays to be safe or to be found.
          </T>
        </Card>

        {!minor && Legal}

        {demo && (() => { const d = demo; return (
          <Card style={{ marginTop: space.lg, gap: space.sm }}>
            <T v="micro" tone="muted">Demo controls</T>
            <T v="small" tone="muted">There is no store in the demo. This switch stands in for a purchase.</T>
            <Button title={plus ? 'Demo: switch Plus off' : 'Demo: switch Plus on'} kind="line" small onPress={async () => { d.setDemoPlus(!plus); await refresh(); await status.reload(); haptic.tick(); }} style={{ alignSelf: 'flex-start' }} />
          </Card>
        ); })()}

        {plus && (
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: space.lg }}>
            <Button title="Auto-match" kind="line" small icon="zap" onPress={() => router.push('/automatch')} />
            <Button title="Your stats" kind="line" small icon="trophy" onPress={() => router.push('/stats')} />
            <Button title="Filters" kind="line" small icon="sliders-horizontal" onPress={() => router.push('/filters')} />
          </View>
        )}
        <View style={{ height: space.lg }} />
      </Centered>
    </Screen>
  );
}
const st = StyleSheet.create({
  mark: { flexDirection: 'row', marginTop: space.md, marginBottom: space.md },
  badgeText: { color: fixed.member, fontFamily: font.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.6 },
  h: { marginTop: 12, marginBottom: 14 },
  k: { marginTop: 24, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: hit.row, paddingVertical: 10 },
});
const useS = makeStyles(c => ({
  badge: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, backgroundColor: fixed.dot },
  why: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.soft, borderRadius: radius.md, padding: 12, marginBottom: space.md, minHeight: 44 },
  rule: { borderTopWidth: 1, borderTopColor: c.line },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: fixed.dot },
}));
