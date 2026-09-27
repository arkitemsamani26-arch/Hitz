// The public pages both app stores require, and the app has to link to.
//
// Set EXPO_PUBLIC_LEGAL_URL to wherever `legal/` ends up (see legal/README.md). It is not
// hard-coded because the first home for those pages is a github.io URL and the second is a
// real domain, and a stale link in a shipped build is worse than no link.
//
// Until it is set, the rows that point at these are simply not rendered. An app that shows
// a "Privacy policy" row leading nowhere fails review more surely than one that shows none.
const base = (process.env.EXPO_PUBLIC_LEGAL_URL ?? '').replace(/\/+$/, '');

export const legal = base
  ? {
      privacy: `${base}/privacy.html`,
      terms: `${base}/terms.html`,
      support: `${base}/support.html`,
    }
  : null;
