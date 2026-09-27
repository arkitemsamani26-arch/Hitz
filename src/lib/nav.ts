// Going back, when there may be nothing to go back to.
//
// `router.back()` is a no-op when the current screen is the first one in the history --
// which happens every time somebody opens a link straight to it, and every time a modal is
// the entry point. The button looks alive and does nothing, which is the single most
// common way an app feels broken.
//
// Found by the crawler on two screens: "Show players" on the filters sheet and "Keep my
// account" on the delete screen.
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

export function useGoBack(fallback: string = '/') {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as never);
  }, [router, fallback]);
}
