// Push: relevant only. Request received, request accepted, guardian approved, hit
// tomorrow. Nothing else, ever.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from '@/data';

let Notifications: typeof import('expo-notifications') | null = null;
try { Notifications = require('expo-notifications'); } catch { Notifications = null; }

export async function registerPush(): Promise<string | null> {
  if (Platform.OS === 'web' || !Notifications) return null;
  try {
    const Device = require('expo-device');
    if (!Device.isDevice) return null;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('hits', { name: 'Hits', importance: Notifications.AndroidImportance.HIGH, sound: 'default' });
    }
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await api.setPushToken(token);
    return token;
  } catch { return null; }
}

// Local notification, used by the demo layer so the phone buzzes at the same moments a
// server would push. On web this is a no-op.
export async function notifyLocal(title: string, body: string, data?: Record<string, string>) {
  if (Platform.OS === 'web' || !Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body, data, sound: 'default' }, trigger: null });
  } catch {}
}

export function configureForeground() {
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}
