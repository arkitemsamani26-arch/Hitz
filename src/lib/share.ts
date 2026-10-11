// Share a line of text: the system share sheet where there is one, the clipboard where
// there is not (most desktop browsers). Says which happened, so the screen can tell you.
import { Platform, Share } from 'react-native';

// The clipboard can sit unresolved when the page lacks permission, so it gets a deadline.
export async function copy(text: string): Promise<'copied' | 'failed'> {
  const nav: any = typeof navigator !== 'undefined' ? navigator : null;
  if (!nav?.clipboard?.writeText) return 'failed';
  const timeout = new Promise<'failed'>(r => setTimeout(() => r('failed'), 700));
  return Promise.race([nav.clipboard.writeText(text).then(() => 'copied' as const, () => 'failed' as const), timeout]);
}

export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (Platform.OS === 'web') {
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    try { if (nav?.share) { await nav.share({ text }); return 'shared'; } } catch { /* cancelled or blocked */ }
    return copy(text);
  }
  try { await Share.share({ message: text }); return 'shared'; } catch { return 'failed'; }
}
