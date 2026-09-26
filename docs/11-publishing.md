# 11. Getting Hits into the app stores

An honest list of what stands between this repo and a listing. Nothing here is hard in a
clever way; it is the unglamorous half of shipping, and most of it cannot be written by
whoever writes the code — it needs an account, a card, a lawyer's eye or a decision.

Hits is in the hardest category the app stores have: **minors, geolocation, and meeting a
stranger in person.** Everything below is stricter because of that, and pretending
otherwise is how a submission gets rejected three times.

---

## Blocking — cannot submit without these

### 1. Developer accounts

| | |
|---|---|
| Apple Developer Program | $99/year |
| Google Play Console | $25, once |

**Apple requires the legal age of majority to enrol** — 18 in California, where Apple is.
Under that, the account has to be a parent's or guardian's, in their name, and apps ship
under their name until you reach majority. Worth sorting early: enrolment verification can
take days, and Google's has its own identity checks.
([Apple Developer: Enrollment](https://developer.apple.com/help/account/membership/program-enrollment/))

### 2. Age assurance

This is the one that is genuinely new and the one most likely to fail review.

- **Apple's Declared Age Range API** (iOS 26) returns an age band and how it was
  established. It needs the `com.apple.developer.declared-age-range` entitlement.
- **Google Play** exposes equivalent age signals, and both stores expect developers to act
  on them rather than just collect them.
- **Texas, Utah and Louisiana** each have an App Store Accountability Act covering everyone
  under 18, and each pushes obligations onto the *developer*, not only the store. Only
  Texas is in force: it took effect **1 January 2026** after the Fifth Circuit stayed an
  injunction against it. **Utah**'s compliance deadline was extended to **6 May 2027** and
  **Louisiana**'s was pushed to **1 July 2027**. Failing to use the signals shows up as a
  compliance gap in review.
  ([Morrison Foerster](https://www.mofo.com/resources/insights/251111-texas-targets-app-stores-with-new-accountability-law) ·
  [Wiley](https://www.wiley.law/alert-State-App-Store-Accountability-Acts-Introduce-New-Obligations-for-App-Developers))

Hits currently asks for a birthday and trusts the answer. That is no longer enough for an
app in this category. The work: request the entitlement, read the band at launch, and
treat a revoked parental consent as a live state that closes access — not a one-time check
at sign-up. The good news is the app is already built around bands, so this feeds an
existing concept rather than needing a new one.
([WWDC25 session 299](https://developer.apple.com/videos/play/wwdc2025/299/) ·
[entitlement docs](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.declared-age-range))

### 3. Account deletion, in the app

Apple requires any app that lets you create an account to let you delete it from inside the
app. **Hits has Sign out and nothing else.** This needs a real deletion path: the profile,
the private row, photos in storage, hit history, and a decision about what happens to the
other side of a completed hit. It is a day of work and it is not optional.

### 4. A published privacy policy and a support URL

Both stores need public URLs before you can fill in the listing. The policy has to actually
describe what Hits does, which is unusually specific: approximate location snapped to a grid,
photos approved by a guardian, phone numbers shared per-hit and revocable, and a guardian
relationship that is itself personal data about a third party. A generic generated policy
will not match the app, and for an app aimed at minors that mismatch is the risk.

Get a real person to read it. This is the one item on the list where I would not trust my
own draft, or a template.

### 5. User-generated content rules

Apple's guideline 1.2 requires apps with UGC to have content filtering, a way to report,
a way to block, and published contact details. Hits has **reporting and blocking already**,
plus a moderation queue with an audit trail — which is more than most apps arrive with.
What is missing is the published contact and a stated response time. The app already tells
users "goes to a person, same day"; that promise now has to be true in a listing.

### 6. Data safety declarations

Both stores make you declare every category collected. For Hits: approximate location,
photos, phone number, and a guardian's email and phone. Declare the guardian's details —
it is easy to forget that a parent's email is personal data about someone who never
installed the app.

### 7. Push notifications do not work yet

`notify` has no schedule on the live project and `pg_cron` is not installed, so the outbox
fills and nothing is ever delivered. Shipping an app whose entire confirmation loop depends
on a parent getting a notification, without notifications, is not shippable. See `09`.

### 8. Build configuration

There is no `eas.json`, no EAS project id in `app.json`, and no bundle identifier
registered with Apple. `registerPush()` reads a project id that does not exist yet.
Roughly: `eas build:configure`, register the identifier, generate credentials, then a
first TestFlight build. A day, if nothing fights back.

---

## The one that is not technical

**The app says "UTR" in 41 places.** It shows UTR ratings, awards a "UTR verified" badge,
and the whole level system is built on their scale.

Without an agreement, that is using another company's trademark as a core feature of a
product you are shipping. It is very likely fine while this is a portfolio piece and a
demo. It is a different question the moment it is a public listing with users, and a
different question again if it ever makes money.

This is worth asking about *before* you submit, not after — and it is a good reason to make
the Engage API application (`10`) the first thing you send. "Can I use your rating in my
app" is a much easier conversation to start than to have retroactively.

I am not a lawyer and this is not legal advice; it is the flag I would want raised if this
were mine.

---

## Not blocking, but do them

- **Terms of service.** Especially the bit about what Hits is not responsible for when two
  people meet at a court.
- **Age rating questionnaire.** Expect 12+ at minimum; social features with UGC may push
  higher. Answer it honestly — a wrong rating is a removal, not a warning.
- **What happens when a safety report is real.** Right now that is you, reading
  `supabase/moderation.sql`. Before there are users, decide: who reads it, how fast, and
  what you do at 11pm on a Saturday.
- **Screenshots and listing copy.** Six per device size. The court screen is the one.
- **A real support inbox**, monitored, that a parent can reach.

---

## An honest order

1. Developer accounts (slowest to clear, so start now)
2. Ask UTR about the rating (`10`) — it may change the product
3. Account deletion, then the notify schedule
4. Privacy policy and support site, read by someone qualified
5. Age assurance entitlement and wiring
6. EAS config → TestFlight → a closed test with the pilot group

**Do not skip to step 6.** A TestFlight build with fifteen real juniors from a local
academy teaches you more than a public listing with nobody on it, and it does not need
most of this list. Publicly listing an app for minors that nobody uses carries all of the
compliance burden and none of the learning.
