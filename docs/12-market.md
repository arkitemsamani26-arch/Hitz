# 12. The numbers, and where each one came from

Everything in the pitch deck is here with its source. Nothing on this page is estimated,
modelled or rounded up. If a figure is derived rather than published, it says so.

Checked 26 September 2026. Re-check before you send anything: the participation figures
are republished every spring.

---

## The sport

| Figure | Source |
|---|---|
| **27.3M** Americans played tennis in 2025 | [USTA / Physical Activity Council](https://www.usta.com/en/home/stay-current/national/tennis-participation-continues-to-surge-with-six-consecutive-yea.html) |
| **+1.6M** in one year; sixth consecutive year of growth | same |
| **+54%** since 2019, close to 10 million added | same |
| **25.7M** in 2024, the previous record | [2025 report, on 2024 data](https://www.usta.com/en/home/stay-current/national/u-s-tennis-participation-surges-to-new-high-of-25-million-players.html) |
| **17.7M** in 2019 | derived: 27.3 ÷ 1.54. Say "about 17.7 million" if asked |

## Where the growth isn't

| Figure | Source |
|---|---|
| **~95%** of 2025's growth came from adults aged 35+ | [USTA 2026 participation report](https://www.usta.com/content/dam/usta/2026-pdfs/2026-us-tennis-participation-report.pdf) |
| **+200,000** players aged 6–17 in 2025, still under the 2021 peak | same |
| **3.7M** junior core players, about 59% of juniors | USTA participation reporting, 2024 data |

This is the whole argument for why juniors are worth a product of their own: the segment is
not growing on its own, and it is the one nobody can serve casually because of the parent.

## Parents

| Figure | Source |
|---|---|
| **88%** of youth sports parents say their child's coach should pass a criminal background check | [Aspen Institute Project Play, State of Play 2025](https://projectplay.org/state-of-play-2025/coaching-trends), with Utah State University and Louisiana Tech |
| **$1,016** average spend on one child's main sport in 2024, **+46%** since 2019 | [Project Play 2025](https://projectplay.org/state-of-play-2025/participation-trends) |
| **13 states** require background checks for volunteers in non-school youth activities | [Little League, as of 19 Dec 2025](https://www.littleleague.org/player-safety/child-protection-program/state-laws-background-checks-leagues/) |

The 88% is the strongest single number available. It establishes that the expectation
already exists in parents' heads, and that meeting a stranger at a public court currently
clears a lower bar than being coached by one.

## UTR Sports

| Figure | Source |
|---|---|
| **1.8M+** rated players (earlier published figure: 1M+ across 130+ countries) | [utrsports.net](https://www.utrsports.net/pages/how-utr-works); [Universal Tennis Rating overview](https://en.wikipedia.org/wiki/Universal_Tennis_Rating) |
| Investors: Amazon, Larry Ellison, TEAM8, Novak Djokovic, Endeavor/IMG, Tennis Channel, Tennis Australia | [Amazon deal, Mar 2022](https://www.utrsports.net/blogs/press/universal-tennis-and-amazon-announce-rights-deal-and-investment-to-elevate-game-of-tennis); [Ellison, Sep 2018](https://www.utrsports.net/blogs/news/larry-ellison-invests-and-partners-with-universal-tennis) |
| Acquired **PicklePlay**, 4 Dec 2024: ~150,000 users, 32,000 courts | [announcement](https://www.globenewswire.com/news-release/2024/12/04/2991592/0/en/UTR-Sports-Acquires-PicklePlay-to-Enhance-Local-Pickleball-Communities-and-Expand-Player-Engagement.html) |
| Already ships Create Play, Find Play, Paid Hit, Flex Leagues | [inside the UTR app](https://www.utrsports.net/blogs/news/a-look-inside-the-new-universal-tennis-mobile-app) |

**Do not claim a valuation or a total raised.** Neither is published. PitchBook and Tracxn
list profiles behind a paywall; a number quoted from a secondhand summary is exactly the
kind of thing that gets caught in a meeting.

The PicklePlay number is the important one and it cuts against you: it is the only
comparable, and it is 150,000 users against your zero. Say it before they do.

## The law

| Figure | Source |
|---|---|
| **Texas** App Store Accountability Act in force **1 January 2026** (a district-court injunction was stayed by the Fifth Circuit) | [Morrison Foerster](https://www.mofo.com/resources/insights/251111-texas-targets-app-stores-with-new-accountability-law) · [Wiley](https://www.wiley.law/alert-Key-Developments-With-State-App-Store-Accountability-Acts-as-Texas-Act-Takes-Effect) |
| **Utah** compliance deadline extended to **6 May 2027** | [Frankfurt Kurnit](https://technologylaw.fkks.com/post/102mpap/utah-first-state-to-amend-its-app-store-accountability-act) |
| **Louisiana** delayed by HB 977 to **1 July 2027** | [Bass, Berry & Sims](https://www.bassberry.com/news/apps-and-minors-new-compliance-frontiers-and-risks-in-louisiana-utah-and-texas/) |
| These acts push obligations onto **developers**, not only app stores | [Wiley](https://www.wiley.law/alert-State-App-Store-Accountability-Acts-Introduce-New-Obligations-for-App-Developers) |
| Apple's **Declared Age Range API** ships in iOS 26; stores expect apps to act on the signal | [WWDC25 session 299](https://developer.apple.com/videos/play/wwdc2025/299/) |

Only Texas is live. Utah and Louisiana were both pushed back a year, so "three states are
enforcing this" is wrong and someone will know it. The accurate line is: one in force, two
scheduled.

## Hits itself

Measured from this repository on 26 September 2026, not estimated.

| Figure | How to re-check |
|---|---|
| **9 days**, 23 commits, 17–26 September 2026 | `git log --oneline \| wc -l` |
| **184** pgTAP assertions across 17 files | `npm run db:test` |
| **27** migrations, 2,993 lines of SQL | `wc -l supabase/migrations/*.sql` |
| **5,774** lines of TypeScript | `find src app -name '*.ts*' \| xargs wc -l` |
| **0** accessibility violations | `npm run a11y` |
| **0** users | nothing to run |

The deck rounds 5,774 + 2,993 to "8.7k lines of app and schema code". That is the only
rounding in it.
