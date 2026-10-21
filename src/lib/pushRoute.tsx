// Tapping a notification opens the thing it is about. Every push the server sends
// carries `{ hit: <id> }` (or `{ code }` for an invite that landed); a parent's goes to the
// approval screen, a player's to the hit, and a new message (`chat: true`) to the thread.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/store/session';

let Notifications: typeof import('expo-notifications') | null = null;
try { Notifications = require('expo-notifications'); } catch { Notifications = null; }

export function routeFor(data: Record<string, unknown> | null | undefined, isGuardian: boolean): string | null {
  if (!data) return null;
  const hit = typeof data.hit === 'string' ? data.hit : null;
  if (hit) return isGuardian ? `/guardian/approve/${hit}` : data.chat ? `/chat/${hit}` : `/hit/${hit}`;
  // A coach's pairing opens Discover, where the suggestion waits; coach news opens the
  // coach's tools, or the family view for a parent asked to approve one.
  if (typeof data.pairing === 'string') return '/(tabs)';
  if (data.coach) return isGuardian ? '/guardian' : '/coach';
  if (typeof data.code === 'string') return '/(tabs)/you';
  // Plus: a child asked for it, a saved search found someone, an auto-match has news.
  if (data.plus) return '/plus';
  // A child got their own sign-in: the parent's family view.
  if (data.family) return '/guardian';
  if (typeof data.search === 'string') return `/filters?saved=${data.search}`;
  if (typeof data.automatch === 'string') return '/automatch';
  return null;
}

export function PushRouter() {
  const router = useRouter();
  const { ready, session, setActing } = useSession();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web' || !Notifications || !ready || !session) return;
    const N = Notifications;
    const go = (resp: any) => {
      const id = resp?.notification?.request?.identifier ?? null;
      if (id && handled.current === id) return;
      handled.current = id;
      const data = resp?.notification?.request?.content?.data;
      // A push about a child the parent runs ({ as: child }) opens the app as that child.
      if (data && typeof data.as === 'string') {
        void setActing(data.as).then(() => { const to = routeFor(data, false) ?? '/(tabs)'; router.push(to as never); });
        return;
      }
      const to = routeFor(data, session.isGuardian);
      if (to) router.push(to as never);
    };
    // A tap that launched the app from cold.
    void N.getLastNotificationResponseAsync().then(r => { if (r) go(r); }).catch(() => {});
    const sub = N.addNotificationResponseReceivedListener(go);
    return () => sub.remove();
  }, [ready, session, router, setActing]);
  return null;
}
