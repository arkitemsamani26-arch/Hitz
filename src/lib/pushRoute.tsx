// Tapping a notification opens the thing it is about. Every push the server sends
// carries `{ hit: <id> }` (or `{ code }` for an invite that landed); a parent's goes to the
// approval screen, a player's to the hit.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/store/session';

let Notifications: typeof import('expo-notifications') | null = null;
try { Notifications = require('expo-notifications'); } catch { Notifications = null; }

export function routeFor(data: Record<string, unknown> | null | undefined, isGuardian: boolean): string | null {
  if (!data) return null;
  const hit = typeof data.hit === 'string' ? data.hit : null;
  if (hit) return isGuardian ? `/guardian/approve/${hit}` : `/hit/${hit}`;
  if (typeof data.code === 'string') return '/(tabs)/you';
  return null;
}

export function PushRouter() {
  const router = useRouter();
  const { ready, session } = useSession();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web' || !Notifications || !ready || !session) return;
    const N = Notifications;
    const go = (resp: any) => {
      const id = resp?.notification?.request?.identifier ?? null;
      if (id && handled.current === id) return;
      handled.current = id;
      const to = routeFor(resp?.notification?.request?.content?.data, session.isGuardian);
      if (to) router.push(to as never);
    };
    // A tap that launched the app from cold.
    void N.getLastNotificationResponseAsync().then(r => { if (r) go(r); }).catch(() => {});
    const sub = N.addNotificationResponseReceivedListener(go);
    return () => sub.remove();
  }, [ready, session, router]);
  return null;
}
