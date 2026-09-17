// Haptics on the moments that matter, and nowhere else.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const native = Platform.OS !== 'web';

export const haptic = {
  // A tap that did something.
  tick: () => { if (native) void Haptics.selectionAsync(); },
  // Request sent.
  sent: () => { if (native) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  // Request accepted.
  accepted: () => { if (native) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  // Hit confirmed. The thud.
  confirmed: () => {
    if (!native) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid), 90);
  },
  warn: () => { if (native) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); },
};
