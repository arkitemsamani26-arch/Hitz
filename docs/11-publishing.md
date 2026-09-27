# 11. Getting Hits into the app stores

Two lists. The first is everything that was blocking a submission and is now done in the
repo. The second is what is left, and almost all of it needs a card, an account, an address
or a human decision — none of which can be written in code.

Hits is in the hardest category the stores have: **minors, geolocation, and meeting a
stranger in person.** Everything below is stricter because of that, and pretending
otherwise is how a submission gets rejected three times.

---

## Done (September 2026)

| | What it was | What it is now |
|---|---|---|
| **Account deletion** | Sign out and nothing else — an automatic rejection under Apple 5.1.1(v) | `You → Delete my account`. Cancels live hits and tells the other player, revokes guardianships, deletes the photo object, the profile and the login. 18 tests. |
| **Safety reports outliving deletion** | `reported_profile_id` cascaded, so deleting your account erased the reports about you | Reports keep a plain `reported_ref`. The link goes soft, the identity stays, and a moderator can still group every report about one person after they leave. |
| **A latent crash** | `reports.reporter_profile_id` was `not null` AND `on delete set null` — a pair that can only ever raise | Both columns nullable, both foreign keys `set null`. Nothing had hit it because no reporter had ever been deleted. |
| **Push notifications** | `notify` had no schedule and `pg_cron` was not installed, so the outbox filled and nothing was ever delivered | `pg_cron` and `pg_net` installed, three jobs scheduled: expire requests every 10 min, tomorrow's reminders hourly, drain the outbox every minute. |
| **The key problem** | `notify` needs the `service_role` key, which must not be in a file | `app.drain_outbox()` reads it from Supabase Vault. Returns `'no key'` and does nothing until you add the secret. Nothing to commit, nothing to leak. |
| **Privacy policy, terms, support** | Did not exist | `legal/` — four pages written against what the app actually does. Needs your details filled in and hosting. |
| **Build config** | No `eas.json` | `eas.json` with development, preview and production profiles. `runtimeVersion` policy and the export-compliance flag are in `app.json`. |
| **Legal links in the app** | None | Privacy, Terms and Help rows on the You screen, from `EXPO_PUBLIC_LEGAL_URL`. They do not render until it is set, because a row leading to a 404 fails review faster than a missing one. |

Bundle identifiers were already registered in `app.json` as `app.hits.mobile` for both
platforms.

---

## Left to do — blocking

### 1. Developer accounts

| | |
|---|---|
| Apple Developer Program | $99/year |
| Google Play Console | $25, once |

**Apple requires the legal age of majority to enrol.** Under 18, the account has to be a
parent's or guardian's, in their name, and the app ships under their name. Whoever's name
is on the account must also be the name you put in `legal/`, or the listing contradicts the
policy. Start this first: enrolment verification can take days, and Google runs its own
identity checks.
([Apple Developer: Enrollment](https://developer.apple.com/help/account/membership/program-enrollment/))

### 2. Fill in and host `legal/`

About twenty `[brackets]`, listed in `legal/README.md`, then GitHub Pages gives you real
URLs in ten minutes. Then set `EXPO_PUBLIC_LEGAL_URL` and the rows appear in the app.

**Get the privacy policy read by someone qualified.** I wrote it against the actual
behaviour — the rounded location and the precise one, the per-hit phone sharing, the
guardian's details being data about a third party, the report that outlives a deleted
account — and that accuracy is the part a reviewer checks. It is still not legal advice, and
for an app used by minors this is the one item where a template is a real risk.

### 3. Add the Vault secret so push actually sends

Supabase dashboard → Project Settings → Vault → New secret:

- Name: `service_role_key`
- Value: your `service_role` key from Project Settings → API

Then `select app.drain_outbox();` should return `called N` rather than `no key`. Until you
do this, every approval, request and reminder sits in the outbox unsent.

Do not put that key in `.env`, in a migration, or anywhere git can see it.

### 4. Age assurance

The one that is genuinely new and the likeliest thing to fail review.

- **Apple's Declared Age Range API** (iOS 26) returns an age band and how it was
  established. Needs the `com.apple.developer.declared-age-range` entitlement, which you
  request from Apple.
- **Google Play** exposes equivalent signals, and both stores expect you to act on them
  rather than just collect them.
- **Texas** has an App Store Accountability Act in force since **1 January 2026**, and it
  pushes obligations onto developers. **Utah** follows on **6 May 2027** and **Louisiana**
  on **1 July 2027**. Only Texas is live; do not say three states are enforcing it.

Hits asks for a birthday and trusts the answer. That is no longer enough here. The work:
request the entitlement, read the band at launch, and treat a revoked parental consent as a
live state that closes access rather than a one-time check at sign-up. The app is already
built around bands, so this feeds an existing idea rather than needing a new one.
([WWDC25 session 299](https://developer.apple.com/videos/play/wwdc2025/299/) ·
[Wiley on the state acts](https://www.wiley.law/alert-State-App-Store-Accountability-Acts-Introduce-New-Obligations-for-App-Developers))

### 5. EAS project and a first build

```
npx eas-cli@latest login
npx eas-cli@latest init          # writes the project id into app.json
npx eas-cli@latest build -p ios --profile preview
```

Register `app.hits.mobile` with Apple first, or the build will ask. `registerPush()` already
reads the project id `eas init` writes, so notifications start working on a real device once
this exists.

### 6. Answer the data safety questionnaires

Both stores make you declare every category you collect. Here is what Hits actually
collects, so you can answer honestly rather than guessing:

| Category | Collected | Linked to you | Used for tracking | Why |
|---|---|---|---|---|
| Phone number | Yes | Yes | No | Sign-in; shared per hit only if you choose |
| Name (first + last initial) | Yes | Yes | No | Shown to other players |
| Date of birth | Yes | Yes | No | Decides the under-18 / adult split |
| Photos | Yes, optional | Yes | No | Profile picture, guardian-approved for minors |
| Coarse location | Yes | Yes | No | Distance between players |
| Precise location | Yes, server only | Yes | No | Never shown to a player or returned to an app |
| Messages | Yes | Yes | No | Arranging one specific hit |
| Contact info of others | Yes | Yes | No | **A guardian's email and phone.** Easy to forget — a parent's email is personal data about someone who never installed the app. |
| Push token | Yes | Yes | No | Notifications |
| Identifiers for advertising | **No** | — | — | There is no advertising in Hits |
| Analytics / usage data | **No** | — | — | There are no third-party analytics SDKs |

Declare the guardian's details. Declaring nothing for advertising and analytics is true and
worth saying — it is unusual and it is good.

### 7. User-generated content

Apple's guideline 1.2 wants content filtering, a way to report, a way to block, and
published contact details. Hits **already has reporting, blocking, a moderation queue with
an audit trail, and auto-hide** — more than most apps arrive with. What was missing was the
published contact and a stated response time, and `legal/support.html` now states both:
safety reports same day, everything else within two working days.

That promise now has to be true. Before you have users, decide who reads a report, how
fast, and what you do at 11pm on a Saturday.

---

## Left to do — not blocking, but do them

- **Age rating questionnaire.** Expect 12+ at minimum; social features with UGC may push
  higher. Answer honestly — a wrong rating is a removal, not a warning.
- **Screenshots and listing copy.** Six per device size. The court screen is the one.
- **A real support inbox**, monitored, that a parent can reach.
- **Test the delete flow on a real build** before you submit. It is the one path with no
  undo, and a reviewer will press it.

---

## The one that is not technical

**The app says "UTR" in 41 places.** It shows UTR ratings, awards a "UTR verified" badge,
and the whole level system is built on their scale.

Without an agreement, that is using another company's trademark as a core feature of a
product you are shipping. Very likely fine while this is a portfolio piece and a demo. A
different question the moment it is a public listing with users, and different again if it
ever makes money.

Ask before you submit, not after — and it is the best reason to make the Engage API
application (`10`) the first thing you send. "Can I use your rating in my app" is a much
easier conversation to start than to have retroactively.

I am not a lawyer and this is not legal advice; it is the flag I would want raised if this
were mine.

---

## An honest order

1. **Developer accounts** — slowest to clear, so start today.
2. **Ask UTR about the rating** (`10`) — it may change the product.
3. **Add the Vault secret** — five minutes, and push starts working.
4. **Fill in `legal/` and turn on Pages** — ten minutes for real URLs.
5. **Get the privacy policy read** by someone qualified.
6. **`eas init` → TestFlight** → a closed test with your pilot group.
7. Age assurance entitlement and wiring.
8. Public listing.

**Do not skip to step 8.** A TestFlight build with fifteen real juniors from a local academy
teaches you more than a public listing with nobody on it, and it does not need most of this
list. Publicly listing an app for minors that nobody uses carries all of the compliance
burden and none of the learning.
