# Organizard 🦎

A calm, cute, utilitarian **iOS moving-inventory app** — capture items with photos,
group them into color-coded boxes inside rooms, track value, generate & scan QR
labels, and **share a move with a partner under role-based permissions**
(Owner / Editor / Viewer).

Built with **Expo + React Native (TypeScript)**, implemented from the
[Organizard design system](./docs/IMPLEMENTATION_CONTRACT.md) handoff bundle.

> Information architecture: **Move › Room › Box › Item.** Pack fast. Find anything. Share the load.

---

## Run it

```bash
npm install          # already done in this repo
npx expo start       # then press “i” for the iOS simulator,
                     # or scan the QR code with Expo Go on a device
```

Camera capture and QR scanning need a **real device** (or a simulator with a camera);
everything else runs anywhere. State persists to the device via AsyncStorage.

Useful scripts: `npm run ios` · `npm run typecheck` (`tsc --noEmit`).

---

## What's implemented

All seven surfaces from the design, with the permission model surfaced throughout:

| Screen | Route | Highlights |
|---|---|---|
| **Onboarding** | `app/onboarding.tsx` | Sign in → create / join a move (gecko lockup, 2 steps) |
| **Dashboard** | `app/(tabs)/index.tsx` | Progress, totals, **Find** search (Room › Box breadcrumb), Room/Status/Value grouping, color-coded box grid, Add box / Add room |
| **Box detail** | `app/box/[id].tsx` | QR card, status changer + **custom statuses**, **markers** (Fragile / Open first…), item list, cover photo, owner-only delete |
| **Add item** | `app/add-item.tsx` | **Camera-first** capture, multi-photo strip, name / value / qty stepper / note, **Save & add another** |
| **Members & sharing** | `app/(tabs)/members.tsx` | Roster with role badges, invite + role picker, owner-only manage |
| **Scan** | `app/(tabs)/scan.tsx` | Live **QR scanner** with four result states (this move / other move / unknown / no access) |
| **QR overlay** | `app/qr/[id].tsx` | Full-screen scannable label |

### Device features wired in
- **expo-camera** — real photo capture (Add item, box cover) and live QR scanning (Scan).
- **react-native-qrcode-svg** — real QR generation encoding `organizard://box/<id>`.
- **AsyncStorage** (via Zustand `persist`) — your move survives app restarts.

### The differentiator: roles
A **“Viewing as” switcher** (top of the Dashboard) flips between **Owner / Editor /
Viewer** so you can watch the same screens gain or lose edit affordances. Gated
actions show a plain-language `LockNote` — never a dead button.

---

## Architecture

```
app/            expo-router routes (file-based navigation + custom tab bar)
components/      design-system primitives + shared chrome (21 components)
theme/           design tokens → TS (colors, 12-hue box palette, type, spacing, shadows)
store/           Zustand store (Move › Room › Box › Item) + AsyncStorage persistence
data/            domain types + the mock "NYC Move" seed
lib/             permissions, money, QR encode/scan-classify
docs/            implementation contract (the build spec)
```

Brand: warm cream paper, fresh green, a friendly gecko, **Fredoka** (display) +
**Nunito** (body, via `@expo-google-fonts`), and a vivid 12-hue box palette used as a
real organizing principle. Copy is sentence-case, warm, and emoji-free in product UI.

---

## Caveats / next steps

- **App icon & splash** use Expo defaults — drop a 1024px PNG into `assets/` and wire
  `app.json` `icon`/`splash` when you have brand art. (The gecko exists as an SVG component.)
- **Fonts** are Google Fonts stand-ins (Fredoka, Nunito) — swap if you license a bespoke face.
- **Member management** (change role / remove) is local UI state — there's no backend yet, so
  it doesn't persist. Same for the **print sheet** (intent only; PDF generation is a follow-up).
- The Scan **“other move” / “no access”** states are reachable via demo buttons since there's
  no second real move on device.
- No auth/sync backend — onboarding just flips a local flag (v1 assumes connectivity per the brief).
