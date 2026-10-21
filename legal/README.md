# Publishing these pages

Both app stores need a **public privacy policy URL** and a **public support URL** before you
can fill in a listing. These four pages are those URLs. They are plain HTML with one
stylesheet and no build step.

## Fastest way to get real URLs (free, ten minutes)

1. The brackets are filled in (October 21, 2026). Re-check them whenever these pages change.
2. Push to GitHub.
3. Repository → Settings → Pages → Source: *Deploy from a branch* → branch
   `claude/hits-tennis-matchmaking-7wi3q9` (the repo's default branch), folder `/ (root)` → Save.
4. A minute later the pages are live at:
   - `https://arkitemsamani26-arch.github.io/Hitz/legal/privacy.html`
   - `https://arkitemsamani26-arch.github.io/Hitz/legal/support.html`
   - `https://arkitemsamani26-arch.github.io/Hitz/legal/terms.html`
5. The app links to them through `EXPO_PUBLIC_LEGAL_URL=https://arkitemsamani26-arch.github.io/Hitz/legal`
   (already in `.env.example`; add it to the EAS production environment too).

That is good enough for a first submission. A domain of your own looks better later, and
these files move to one unchanged.

## The brackets you must fill

| Bracket | What goes there |
|---|---|
| `[your legal name or company]` | Whoever the app is published under. Under 18, this is your parent or guardian, and it must match the developer account. |
| `[address]` | A postal address. Required by the app stores and by privacy law. |
| `[support@yourdomain]` | A real inbox you actually read. Not the one you forgot the password to. |
| `[date]` | The date you publish, and again whenever you change these. |
| `[SMS provider]` | Whoever Supabase Auth sends your sign-in codes through. Check your Supabase Auth settings. |
| `[retention period…]`, `[30] days`, `[two] working days` | Pick numbers you can actually meet, then meet them. |
| `[state/country]`, `[place]` | Where you live. |

## Before you rely on this

I wrote these to match what the app actually does, line by line — the rounded location and
the precise one, the per-hit phone sharing, the guardian's details being data about a third
party, the report that outlives a deleted account. That accuracy is the part that is hard
to get from a template, and it is the part a reviewer checks.

It is still not legal advice, and I am not a lawyer. For an app used by minors, get someone
qualified to read the privacy policy and the liability section of the terms before you put
either in front of a store. It is the one item on the publishing list where a template is a
genuine risk rather than a shortcut.
