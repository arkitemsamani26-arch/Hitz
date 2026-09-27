# 13. Running Hits on your phone

Two ways. The first takes ten seconds and needs nothing installed. The second is the real
app on real hardware, which is the one that tells you whether it feels good.

---

## 1. The quickest look: the hosted build

Open the demo link on your phone's browser. It is the whole app, seeded with players, and
it needs no install and no sign-up. Sign in with any number; the code is `000000`.

This is what to send people. It is also what to open when somebody asks "can I see it?"
across a table.

What it cannot do, because a browser cannot: push notifications, haptics, the camera, and
the share-card image. Everything else is the real thing.

---

## 2. Expo Go, on your own machine

Nothing on a cloud machine can serve a dev server to your phone — they are not on the same
network, and tunnelling out is blocked. So this part runs on your computer.

### Once, if you have never done this

Install **Node.js LTS** from [nodejs.org](https://nodejs.org) and **Git** from
[git-scm.com](https://git-scm.com/downloads).

**Then close your terminal and open a new one.** Windows only adds newly installed programs
to a terminal's PATH when the terminal starts, so `git` will still say "not recognized" in
the window you installed it from. This is the single most common place this goes wrong.

Check both are there:

```
node -v
git --version
```

If either errors, the new-terminal step did not happen, or the install did not finish.

### Get the code and start it

Paste these one at a time. **Do not edit the paths** — `cd $HOME` goes to your own user
folder, wherever that is.

```powershell
cd $HOME
git clone https://github.com/arkitemsamani26-arch/Hitz.git
cd Hitz
git checkout claude/hits-tennis-matchmaking-7wi3q9
npm install
npx expo start
```

On macOS or Linux the same commands work, with `cd ~` instead of `cd $HOME`.

`npm install` takes a few minutes the first time. When `npx expo start` finishes it prints
a **QR code** in the terminal.

### On the phone

1. Install **Expo Go** from the App Store or Play Store.
2. **iPhone:** open the Camera app, point it at the QR code, tap the banner.
   **Android:** open Expo Go and use *Scan QR code* inside the app.
3. Your phone and your computer must be on **the same Wi-Fi**. Not the same house — the
   same network. A phone on cellular will sit on a white screen forever.

### What you will see

The app starts in **demo mode** whenever no Supabase project is configured, which is the
case on a fresh clone with no `.env`. That is what you want: 27 junior players already on
the court, a pending request waiting, and nothing that can touch the live database.

To point it at the real backend instead, copy `.env.example` to `.env` and fill it in. Do
that later, and never put the `service_role` key in it.

### If it does not load

| What you see | What it is |
|---|---|
| `git` or `node` not recognized | New terminal. See above. |
| `npm error enoent package.json` | You are in the wrong folder. `cd $HOME\Hitz` first. |
| QR scans but hangs on white | Phone is not on the same Wi-Fi, or a VPN is on. |
| "Project is incompatible with this version of Expo Go" | Update Expo Go from the store. This project is SDK 57. |
| Red screen with a stack trace | Screenshot it. That is a real bug and worth reporting. |

### One thing that will not work in Expo Go

The **share card** — the image generated when a hit is confirmed — needs
`react-native-view-shot`, which is not one of the modules Expo Go ships. It is loaded
lazily inside a try/catch, so nothing crashes: the share button falls back to sharing text
instead of the picture. Everything else, including push notifications and haptics, works.

To get the share card you need a development build (`eas build --profile development`),
which is on the publishing list in `11`.
