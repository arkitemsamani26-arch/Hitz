# 3. Tech Stack

## Recommendation

| Layer | Choice | Why |
| --- | --- | --- |
| Mobile app | **Expo (React Native) + TypeScript** | One codebase, iOS-first launch with Android essentially free later. Expo's OTA updates matter a lot in a closed beta where you're iterating weekly. React Native Reanimated + Gesture Handler are what make Direction B's swipe stack and match-found moment feel native rather than web-in-a-box. |
| Backend / DB | **Supabase (Postgres + PostGIS)** | Postgres with real geospatial queries is exactly the shape of this problem: "players within N miles, ordered by level delta." PostGIS does that in one indexed query. Row Level Security lets the minor-safety rules live *in the database* rather than in app code — see below, this is the single biggest architectural argument. |
| Auth | **Supabase Auth, phone/OTP via Twilio** | Phone verification is a safety requirement, not a convenience; making it the login method means it can't be skipped. |
| Realtime | **Supabase Realtime** | Hit-request state changes and thread messages. Low volume, no need for a separate socket tier. |
| Push | **Expo Push → APNs/FCM** | Push is load-bearing for this product (a request that isn't seen for 8 hours is a dead request). |
| Media | **Supabase Storage + image transform** | Profile photos only. |
| Maps/geocoding | **Mapbox** | Better pricing and styling control than Google at this scale, and the app is court-centric rather than turn-by-turn. |
| Analytics | **PostHog** | Funnels for the one metric that matters (request → accept → confirmed hit). Self-hostable if minor-data policy demands it. |
| Error tracking | **Sentry** | |
| CI | **GitHub Actions + EAS Build** | |

### Why not the alternatives

- **Flutter** — excellent, and the animation story is arguably stronger. Passed over
  because the RN/TS ecosystem is deeper for the specific integrations here (Supabase,
  PostHog, Stripe Connect later) and because TypeScript end-to-end means shared types
  between app and edge functions. If you'd rather write Dart, Flutter + Supabase is a
  perfectly good substitute and changes nothing else in this document.
- **Firebase** — faster to start, but Firestore makes geo + "order by |level delta|"
  queries awkward (geohash workarounds), and its security rules are far weaker than
  Postgres RLS for the guardian/minor model. Wrong tool for a matching product.
- **Custom Node/Nest + Postgres on Fly/Railway** — more control, and where you end up if
  Supabase's limits bite. Not worth the setup cost at zero users. Supabase *is* Postgres,
  so this migration stays open.
- **Web-first PWA** — no. Push notifications and location on iOS PWAs remain second-class,
  and both are core.

## Architecture note: safety belongs in the database

The single most important structural decision: **the rules that protect minors are RLS
policies, not app-layer checks.** A visibility bug in a React component is a bad day; a
visibility bug that lets an adult enumerate minors is the end of the product. So:

- `profiles` rows carry `is_minor` (derived from DOB, never client-settable).
- An RLS policy on the discovery view enforces the minor/adult separation. The client
  *cannot* query around it, whatever the app code does.
- Precise coordinates live in a column no client role can select. Clients read a
  `discovery_profiles` view exposing only a snapped centroid and a distance bucket.
- Contact-permission checks (blocked, guardian-approved) are policy predicates, so every
  future feature inherits them by default rather than having to remember them.

## Data model sketch

```
profiles          id, display_name, last_initial, photo_url, dob, is_minor (gen),
                  level_value, level_source (utr_verified|utr_self|estimated),
                  home_court_id, availability_mask, responsiveness_score,
                  hits_confirmed, verified_phone, status
profiles_private  profile_id, exact_point (geography, NO client select), phone, email
guardians         minor_profile_id, guardian_user_id, relationship, verified_at
courts            id, name, point, surface, public|club, address
hit_requests      id, from_profile, to_profile, court_id, window_start, window_end,
                  note, state (pending|accepted|declined|countered|expired|completed),
                  guardian_approval_state, expires_at
hit_messages      hit_request_id, sender, body, created_at
hit_confirmations hit_request_id, profile_id, did_play, created_at
blocks            blocker_id, blocked_id
reports           reporter_id, reported_id, hit_request_id?, reason, body, state
invites           code, issued_by, redeemed_by, redeemed_at, market_id
```

The discovery query, essentially:

```sql
select *, abs(p.level_value - :me) as level_delta
from discovery_profiles p
where ST_DWithin(p.snapped_point, :my_point, :radius_m)
  and p.level_value between :lo and :hi
  and p.availability_mask & :want > 0
order by level_delta asc, ST_Distance(p.snapped_point, :my_point) asc
limit 50;
```

GiST index on `snapped_point`, btree on `level_value`. This stays fast well past the
point where any of it matters.

## Build order

1. Schema + RLS policies + seeded courts table. Safety model first, before any UI — it's
   much harder to retrofit than to start with.
2. Auth + onboarding + profile.
3. Discovery query + feed (list view first; the stack is a presentation layer on the
   same data).
4. Hit request state machine + push.
5. Confirmation + responsiveness scoring.
6. Block/report/moderation queue.
7. Invite codes.
8. Then, and only then, the match-found animation.
