# 14. The twenty-item legal checklist, against Hits

Audited against the code on 7 October 2026, not from memory. Where it says *done*, the
check is written down somewhere that runs — a test, the a11y suite, the button crawler —
rather than something I looked at once.

Three of the twenty turned out to be real work and are now done. Four are yours. The rest
were already true, and several are true in a way worth saying out loud to a reviewer.

| # | Item | Where Hits stands |
|---|---|---|
| 1 | **Privacy policy** | Written, matched line by line to what the app does: `legal/privacy.html`. **Needs your details and a lawyer's eye.** |
| 2 | **Terms of service** | `legal/terms.html`, including what Hits is *not* responsible for when two people meet at a court. **Needs your details.** |
| 3 | **Refund policy** | Nothing is sold. The terms now say so in a *Money* section rather than leaving it unsaid — free, no purchases, no subscription, nothing to refund, and if that ever changes we publish a policy first. |
| 4 | **Cookie policy** | **Hits sets no cookies.** No advertising identifier, no pixel, nothing cross-app. Now stated plainly in the privacy policy, along with the two things stored on your own device (your sign-in, and whether sound is on). |
| 5 | **Cookie consent banner** | **Deliberately none.** With no cookies and no tracking there is nothing to consent to, and a banner asking permission for nothing is itself misleading. Worth being able to say this confidently in review. |
| 6 | **Check form consents** | Audited. Nothing is pre-ticked, nothing is bundled. Location asks through the OS prompt with a purpose string; the photo is optional and, for a minor, a guardian approves it before anyone sees it; the guardian's email is entered knowingly by the player. There is no marketing opt-in because there is no marketing. |
| 7 | **No unnecessary data** | **Fixed, and it was the best item on this list.** The app stored your device's precise coordinates server-side purely to compute the rounded ones. Coordinates are now rounded on arrival and the exact point is never written down — the column is dropped, so it cannot come back. |
| 8 | **Audit third-party SDKs** | **Zero.** No analytics, no ads, no crash reporter, no attribution SDK — verified against `package.json`. Everything in there is Expo, React Native, or Supabase. This is unusual and worth declaring. |
| 9 | **Remove dark patterns** | Audited. No fake scarcity, no countdown pressure, no confirm-shaming. Deleting your account is two taps from the profile tab, not buried, and the screen tells you exactly what goes and what stays before you can press it. |
| 10 | **Hidden fees** | None. The app is free end to end. |
| 11 | **Fake reviews** | None in the app. **But see below** — the demo's seeded players are a real launch risk. |
| 12 | **Unsupported claims** | Audited the user-facing copy. The two promises that could bite are "goes to a person, same day" on the report button and the UTR verified badge. Both are backed: the badge is only granted after a human checks the profile, and the support page now commits to the same-day figure in writing. Keep them true or change the words. |
| 13 | **Accessibility alt text** | **Fixed.** Three decorative textures were unlabelled images; they are now hidden from screen readers rather than announced. Photos and avatars were already labelled. |
| 14 | **Colour contrast** | Done, and it stays done: axe at WCAG AA across ten screens, in CI on every push. |
| 15 | **Keyboard navigation** | **Partly.** Every control has a role and a label, and axe passes, but nobody has driven the web build on a keyboard alone. Worth an hour before a public listing. |
| 16 | **Business details** | The brackets in `legal/` — your legal name and a postal address. Required by both stores and by privacy law. |
| 17 | **Age consent for kids' data** | This is the product. Under 18 cannot be found or arrange anything until a guardian links and confirms; each meetup is approved separately; under 13 is prohibited. The gap is *verifiable* age, not consent — see `11`, item 4. |
| 18 | **Unsubscribe in emails** | Hits sends no marketing email. The only emails are transactional, to a guardian, about their own child. A guardian can end the link from the page they were sent, which stops them. |
| 19 | **Licence fonts and images** | Fonts are Bricolage Grotesque, Instrument Sans and Archivo through `@expo-google-fonts` — all SIL Open Font License, fine to ship commercially. **The icons and the court texture in `assets/` have no recorded provenance.** If you did not make them, find out where they came from before you list. |
| 20 | **Data deletion request** | Done three ways: in-app under You, by email to support, and documented in the privacy policy — including the one thing that survives, and why. |

---

## The one that is not on the list, and should be

**The demo has 27 junior players who do not exist.** They have names, levels, response
rates and hit counts, and they look exactly like real users because that is the point of a
demo.

That is fine today. It stops being fine the moment the app is publicly listed: seeded
accounts presented as real people are the same category of problem as a fake review, and
for an app whose whole claim is that it is safe for children, "most of the people on here
are made up" is the worst possible first press.

Before any public listing, one of these has to be true:

- the demo players only exist in demo mode, which nobody can reach from a store build, or
- they are visibly labelled as examples, or
- there are enough real players that they can be deleted.

The third is the one to aim for, and it is what the club pilot is for.

---

## Yours, in order

1. Fill in the brackets in `legal/` — your name and a postal address (16).
2. Get the privacy policy read by someone qualified (1).
3. Find out where the icons came from (19).
4. Drive the web build on a keyboard for an hour (15).

Everything else on the twenty is either done or deliberately not applicable, and the
reasons are written down above so you can answer for each one.

I am not a lawyer and this is not legal advice. It is an honest audit of what the code
does, which is the part a template cannot give you.
