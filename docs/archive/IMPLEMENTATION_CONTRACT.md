# Organizard — Implementation Contract

You are translating an **HTML/CSS/JS design prototype** into a **production Expo /
React Native (TypeScript)** app. This document is the binding contract: build your
assigned file(s) to match these signatures exactly so everything composes.

The app is **Organizard** — a calm, cute, utilitarian iOS moving-inventory app.
Brand: warm cream paper, fresh green, a friendly gecko, rounded Fredoka + Nunito,
a vivid 12-hue box palette used as a real organizing principle.

---

## 0. The design source (READ IT)

The original prototype lives here (read-only):

```
DESIGN_DIR = <design handoff bundle, not in repo>
```

- Component primitives: `DESIGN_DIR/components/{core,forms,domain}/<Name>.jsx` (+ `.d.ts`, `.prompt.md`)
- Screens: `DESIGN_DIR/ui_kits/packing/<Screen>.jsx` plus `shared.jsx`, `App.jsx`, `data.js`
- Brand guide: `DESIGN_DIR/readme.md` (voice, visual foundations)

**Read the relevant design file(s) for your task top-to-bottom before writing.**
Recreate the *visual result* (sizes, colors, spacing, copy) — do NOT copy the DOM
structure. Translate `<div>`→`<View>`, `<span>/text`→`<Text>`, `<button>`→`Pressable`,
CSS → `StyleSheet.create`, CSS vars → the theme tokens below.

---

## 1. Rules (hard)

- **Write ONLY your assigned file(s).** Do not touch `package.json`, any config,
  `theme/*`, `store/*`, `lib/*`, `data/*`, `components/index.ts`, or other agents' files.
- **Do NOT run** `npm`/`expo`/`yarn` install or any build. Deps are already installed.
- TypeScript, strict mode. No `any` unless unavoidable. Every prop typed.
- Import tokens/helpers via the `@/` alias (e.g. `import { colors } from '@/theme'`).
- All text lives inside `<Text>`. Numbers/strings never bare in a `<View>`.
- Use `Pressable` for taps with a pressed state (scale ~0.97 or opacity), matching
  the design's tactile press. Tap targets ≥ 44px.
- Copy is **sentence case**, warm, plain-spoken, addresses the user as "you", **no emoji**.
  Reuse the exact microcopy from the design files where present.
- No external packages beyond what's listed in §3. No CSS-in-JS libs.

---

## 2. How to style (React Native, not CSS)

- `StyleSheet.create({...})` at the bottom of the file. Spread tokens into styles.
- **Colors**: from `@/theme` — `colors.*`, `palette.*`, and the box palette via
  `boxColor(name)` / `boxTint(name)`.
- **Spacing**: `space[1..20]` (4px grid; `space[4]` = 16). Screen gutter = `gutter` (16).
- **Radius**: `radius.{xs,sm,md,lg,xl,'2xl',pill}`.
- **Shadows**: spread a shadow token into a style — `{ ...shadow.sm }`. Tokens:
  `shadow.{xs,sm,md,lg,xl,brand}`. (These already include iOS shadow + Android elevation.)
- **Type**: spread a role from `type` — `{ ...type.body }`, `type.screenTitle`,
  `type.heading`, `type.cardTitle`, `type.label`, `type.caption`, `type.eyebrow`,
  `type.numeral`, `type.display`. Or use `fonts.display.bold` / `fonts.body.bold`
  etc. as a `fontFamily`. NEVER rely on `fontWeight` for Fredoka/Nunito — pick the
  matching family string instead (the weights are separate font files).
- **Icons**: `import { Icon } from '@/components'` → `<Icon name="scan-line" size={24} color={...} />`.
  Names are kebab-case Lucide names (same as the design uses).

---

## 3. Allowed dependencies

`react`, `react-native`, `expo-router`, `expo-image`, `expo-camera`, `expo-haptics`,
`react-native-svg`, `react-native-qrcode-svg`, `react-native-safe-area-context`,
`lucide-react-native` (via the `Icon` component), and anything under `@/`.

---

## 4. Theme API (`@/theme`) — exact exports

```ts
palette: { cream50, cream100, cream200, sand300, sand400, sand500,
           ink900, ink700, ink500, ink400, white,
           green50..green800, amber50..amber600, blue50..blue600, red50..red600 }   // hex strings
boxPalette: Record<BoxColor, { solid: string; tint: string }>
BOX_COLORS: BoxColor[]   // ordered hue names: coral, amber, gold, lime, green, teal, sky, indigo, orchid, rose, clay, slate
boxColor(name: string): string   // solid hue, falls back to green
boxTint(name: string): string    // soft tint wash
colors: { surfaceApp, surfaceCard, surfaceSunken, surfaceInverse, scrim,
          textStrong, textBody, textMuted, textPlaceholder, textOnBrand, textOnDark, textLink,
          borderSubtle, borderStrong, borderFocus,
          brand, brandHover, brandPressed, brandWash,
          success, successWash, warning, warningWash, danger, dangerWash, info, infoWash }
space: {0,1,2,3,4,5,6,8,10,12,16,20}   // px (4px grid)
gutter: 16
radius: { xs:6, sm:10, md:14, lg:18, xl:24, '2xl':32, pill:999 }
shadow: { xs, sm, md, lg, xl, brand }  // spreadable RN shadow style objects
tap: { min:44, sm:36, md:44, lg:52 }
duration: { fast:120, base:200, slow:320 }
fonts: { display:{regular,medium,semibold,bold}, body:{regular,semibold,bold,extra} }  // fontFamily strings
fontSize: { '2xs':11, xs:12, sm:13, base:15, md:17, lg:20, xl:24, '2xl':30, '3xl':38, display:46 }
type: { display, title, screenTitle, heading, cardTitle, body, bodyBold, label, caption, eyebrow, numeral }  // TextStyle presets
```

## 5. Helpers

```ts
import { money } from '@/lib/money';            // money(642) => "$642"
import { PERM, ROLE_LABEL, ROLE_BLURB, ROLE_ICON } from '@/lib/permissions';
//   PERM.canEdit(role) | PERM.canManage(role) | PERM.canDelete(role)
//   ROLE_LABEL.owner="Owner"; ROLE_BLURB.editor="Can add & edit everything"; ROLE_ICON.viewer="eye"
import { encodeBoxQR, parseBoxQR, classifyScan, DEMO_OTHER_MOVE, DEMO_NO_ACCESS, type ScanResult } from '@/lib/qr';
import { uid } from '@/lib/uid';
```

## 6. Data types (`@/data/types`)

`Role` = 'owner'|'editor'|'viewer'. `Move{name,from,to,target}`.
`Room{id,name,dest:string|null,icon}`. `Status{id,label,color,custom?}`.
`Marker{id,label,color,icon,custom?}`. `Box{id,number,name,color,roomId,status,markers:string[],cover?,hasPhoto?}`.
`Item{id,boxId,name,qty,value,icon?,note?,markers?:string[],photos?:string[]}`.
`Member{id,name,role,you?}`. `IndexedItem` = Item + {boxName,boxNumber,boxColor,roomId,roomName}.

> `color`/marker `color`/status `color` values are **box-palette hue names** (e.g. "amber", "sky") — resolve with `boxColor()` / `boxTint()`.

## 7. Store API (`@/store/useStore`)

`useStore` is a Zustand hook (persisted to AsyncStorage). Read with selectors:
`const boxes = useStore(s => s.boxes)`. Grab actions the same way.

State: `onboarded, role, move, rooms, boxes, statuses, markers, members, itemsByBox`.

Actions:
```ts
setOnboarded(v) ; setRole(role)
addRoom({name, dest?, icon?}) -> id
addBox({name, color, roomId, status?}) -> id ; deleteBox(boxId)
setBoxStatus(boxId, statusId) ; setBoxCover(boxId, uri|null) ; toggleBoxMarker(boxId, markerId)
addStatus({label, color}) -> id ; addMarker({label, color, icon?}) -> id
addItem(boxId, {name, qty?, value?, note?, photos?, markers?, icon?}) -> id
updateItem(boxId, itemId, patch) ; deleteItem(boxId, itemId)
reset()
```

Selectors / derived (import named, call with the store state):
```ts
import { useStore, selectBoxItems, boxStats, moveProgress, moveTotals,
         statusById, markerById, roomById, boxById, allIndexedItems } from '@/store/useStore';
// e.g.  const stats = useStore(s => boxStats(s, boxId));   // {count, value}
//       const prog  = useStore(moveProgress);              // {sealed, total}
//       const items = useStore(s => selectBoxItems(s, boxId));
//       const found = useStore(allIndexedItems);           // IndexedItem[] for Find
//       const status = useStore(s => statusById(s, box.status));   // {label,color} | undefined
```

### Resolve recipe (use everywhere a box is shown)
```ts
const status = useStore(s => statusById(s, box.status));      // -> {label, color}
const markerDefs = useStore(s => box.markers.map(id => markerById(s, id)).filter(Boolean));
const room = useStore(s => roomById(s, box.roomId));
const { count, value } = useStore(s => boxStats(s, box.id));
// then: <StatusChip label={status?.label ?? '—'} color={status?.color ?? 'slate'} />
//       <BoxCard ... statusLabel={status?.label ?? ''} statusColor={status?.color ?? 'slate'}
//                markers={markerDefs.map(m => ({label:m.label,color:m.color,icon:m.icon}))} />
```

---

## 8. Component primitives — exact prop contracts

All live in `components/<Name>.tsx`, `export function <Name>`, and are re-exported
from `components/index.ts` (already written — match these names/types). Each also
exports its `Props` type (e.g. `export type ButtonProps = {...}`). Read the matching
`DESIGN_DIR/components/.../<Name>.jsx` for the visual spec.

```ts
// core/Button.jsx  -> components/Button.tsx
type ButtonProps = { variant?: 'primary'|'secondary'|'ghost'|'danger'; size?: 'sm'|'md'|'lg';
  fullWidth?: boolean; disabled?: boolean; iconLeft?: string; iconRight?: string;
  onPress?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle> };
// iconLeft/iconRight are Lucide icon NAMES rendered via <Icon>. Pill shape, bold Nunito,
// press scale 0.97. primary=brand+shadow.brand, secondary=white+border, ghost=transparent green, danger=danger bg.

// core/IconButton.jsx -> components/IconButton.tsx
type IconButtonProps = { icon: string; onPress?: () => void;
  variant?: 'plain'|'brand'|'ghost'|'danger'; size?: 'sm'|'md'|'lg';
  accessibilityLabel?: string; disabled?: boolean; style?: StyleProp<ViewStyle> };
// circular tappable icon. plain = cream200 circle / ink700 icon; brand = green circle / white icon.

// core/Badge.jsx -> components/Badge.tsx
type BadgeProps = { label: string; tone?: 'neutral'|'brand'|'success'|'warning'|'danger'|'info';
  size?: 'sm'|'md'; style?: StyleProp<ViewStyle> };
// small pill, tinted bg + colored text.

// core/StatusChip.jsx -> components/StatusChip.tsx
type StatusChipProps = { label: string; color: string; size?: 'sm'|'md'; style?: StyleProp<ViewStyle> };
// dot (boxColor) + label on a boxTint(color) pill. `color` is a hue name.

// core/Avatar.jsx -> components/Avatar.tsx
type AvatarProps = { name: string; size?: number; uri?: string; color?: string; style?: StyleProp<ViewStyle> };
// initials on a tinted circle (boxTint(color)/boxColor(color) text), or the image if uri given. default size 40.

// forms/Input.jsx -> components/Input.tsx
type InputProps = { value: string; onChangeText: (t: string) => void; label?: string;
  placeholder?: string; keyboardType?: 'default'|'number-pad'|'decimal-pad'|'email-address';
  multiline?: boolean; prefix?: string; autoFocus?: boolean; style?: StyleProp<ViewStyle> };
// label (eyebrow) above a rounded (radius.md) field, sand border, focus = borderFocus. prefix e.g. "$".

// forms/Stepper.jsx -> components/Stepper.tsx
type StepperProps = { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number };
// − [value] + pill. default min 1, step 1.

// forms/Segmented.jsx -> components/Segmented.tsx
type SegmentedProps = { options: { value: string; label: string }[]; value: string;
  onChange: (v: string) => void; size?: 'sm'|'md'; style?: StyleProp<ViewStyle> };
// pill track; active segment = white card + shadow.sm (on cream) or brand (your call, match design).

// domain/BoxCard.jsx -> components/BoxCard.tsx
type BoxCardProps = { name: string; number?: number; color: string; room?: string;
  itemCount?: number; value?: number; statusLabel: string; statusColor: string;
  markers?: { label: string; color: string; icon: string }[]; cover?: string | null;
  onPress?: () => void; style?: StyleProp<ViewStyle> };
// White card, top color rail (5px boxColor), tint/cover band w/ #number + StatusChip, body: name (Fredoka),
// room eyebrow, itemCount + money(value), up to 3 MarkerChip. Press scale 0.985.

// domain/RoleBadge.jsx -> components/RoleBadge.tsx
type RoleBadgeProps = { role: Role; size?: 'sm'|'md'; withBlurb?: boolean; style?: StyleProp<ViewStyle> };
// ROLE_ICON[role] + ROLE_LABEL[role]; if withBlurb, append ROLE_BLURB[role] line. owner=brand, editor=info, viewer=muted tones.

// domain/Marker.jsx -> components/MarkerChip.tsx   (NOTE: file/export is MarkerChip to avoid the Marker type clash)
type MarkerChipProps = { label: string; color: string; icon: string; size?: 'sm'|'md';
  selected?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> };
// icon + label pill in boxTint(color)/boxColor(color). If onPress given it's a toggle (selected = filled hue).

// domain/ColorDot.jsx -> components/ColorDot.tsx
type ColorDotProps = { color: string; size?: number; selected?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> };
// solid boxColor circle; selected = ring. Used in hue pickers (map over BOX_COLORS).

// domain/ValueStat.jsx -> components/ValueStat.tsx
type ValueStatProps = { label: string; value: string | number; icon?: string;
  tone?: 'default'|'brand'; align?: 'left'|'center'; style?: StyleProp<ViewStyle> };
// big Fredoka numeral (type.numeral) + caption label. brand tone = green value.
```

Import `StyleProp, ViewStyle` from `'react-native'`, `Role` from `'@/data/types'`.

---

## 9. Screens — routes, params, contracts

Each is an expo-router route with a **default export**. Read its design file in
`DESIGN_DIR/ui_kits/packing/`. Wrap content in `SafeAreaView`
(`react-native-safe-area-context`) with `backgroundColor: colors.surfaceApp`. Use a
`ScrollView` for scrollable content. Pull data from the store, gate affordances with
`PERM` + the current `role` (`useStore(s => s.role)`), and show `<LockNote>` (never a
dead button) when a Viewer hits a gated action.

Navigation: `import { router, useLocalSearchParams } from 'expo-router'`.
- Open a box: `router.push(\`/box/${id}\`)`
- Open add-item: `router.push({ pathname: '/add-item', params: { boxId } })`
- Open QR: `router.push(\`/qr/${id}\`)`
- Back: `router.back()`

```
app/onboarding.tsx            default Onboarding   (design: Onboarding.jsx)
  Sign in (email or "Continue with Apple"), then "Create a move" / "Join a move".
  Keep to 1–2 steps, no long tutorial. On finish: useStore.getState().setOnboarded(true) then router.replace('/(tabs)').
  Gecko + wordmark lockup at top (GeckoMark + "Organizard" in Fredoka).

app/(tabs)/index.tsx          default Dashboard    (design: Dashboard.jsx)
  - <RoleSwitcher/> pinned near the top (demo control).
  - Header: move.name + subtitle "{sealed} of {total} boxes sealed" (moveProgress).
  - Totals row: 3 <ValueStat> — boxes / items / money(value) from moveTotals.
  - Find: a search field; when query non-empty, search allIndexedItems by name and
    render results as rows with a "Room › Box #n" breadcrumb; tap → open that box.
  - Group control: <Segmented> Room | Status | Value (default Room). Group boxes by room
    (room header = room.name + optional dest); within a group a 2-up <BoxCard> grid.
  - "Add box" + "Add room" actions — Owner/Editor only (PERM.canEdit). Each opens a <Sheet>:
      Add box: Input(name) + hue picker (ColorDot over BOX_COLORS) + room picker -> addBox().
      Add room: Input(name) + Input(dest, optional) + icon picker -> addRoom().
    Empty rooms still render with an "add a box here" prompt.
  - Viewer: hide Add box/room; cards are read-only (still tappable to view).

app/box/[id].tsx              default BoxDetail    (design: BoxDetail.jsx)
  params: { id }. const box = useStore(s => boxById(s, id)).
  - Header (back, box.name, subtitle = room.name [· dest]). Trailing IconButton "more" (owner: edit/delete).
  - Cover photo slot (Thumb large / box.cover); Owner/Editor can set a cover (camera or skip — a button is fine).
  - QR card: small QRCode (encodeBoxQR(id)) + "Show full-screen" (-> /qr/[id]) + "Add to print sheet".
  - Status: current <StatusChip>; if PERM.canEdit, tappable -> <Sheet> to pick an existing status
    or create one (Input + ColorDot picker -> addStatus then setBoxStatus). One status per box.
  - Markers section: the box's <MarkerChip>s; if canEdit, "Edit markers" -> <Sheet> toggling all markers
    (toggleBoxMarker) + create new (Input + icon + ColorDot -> addMarker).
  - Items: list rows (Thumb(item.icon/photo) + name + "qty • value"); empty state
    "No items yet — add your first one to start packing." + the Add item button.
  - "Add item" -> /add-item?boxId=id  (Owner/Editor; Viewer sees LockNote).
  - Delete box: Owner only, confirm via Alert.alert, then deleteBox + router.back().
  - Viewer: read-only, but QR + print still available.

app/add-item.tsx              default AddItem      (design: AddItem.jsx) — modal
  params: { boxId }. The highest-frequency flow — optimize for speed.
  - Camera-first: <CameraView> (expo-camera) with useCameraPermissions; a capture button
    takes a photo (takePictureAsync) and appends the uri to a photo strip. Allow multiple photos.
    If permission denied, show a friendly fallback + "Open settings" (Linking.openSettings()).
  - Fields: Input(name, autoFocus), Input(value, prefix "$", decimal-pad), Stepper(qty, default 1),
    Input(note, multiline). Optional marker toggles (MarkerChip).
  - Two actions: "Save & add another" (addItem then reset the form fields + keep camera, stay on screen)
    and "Save" (addItem then router.back()). Sensible defaults (qty 1, value 0).
  - Close (X) -> router.back().

app/(tabs)/members.tsx        default Members      (design: Members.jsx)
  - Header "Members & sharing".
  - Roster: each member = Avatar + name (+ "You") + <RoleBadge role withBlurb>.
  - Invite (visible to all): a card/button -> <Sheet> "Invite a packing buddy": role picker
    (Segmented or RoleBadge options) + a fake invite link/code + "Copy invite link"
    (Clipboard optional; a pressed confirmation is fine).
  - Manage (Owner only, PERM.canManage): tapping a member -> <Sheet> to change role / remove member
    (these can update local component state or be no-ops with a toast — store has no member mutators,
     so keep member management as local UI state; do NOT add store actions).
  - States: solo (only owner -> prominent invite prompt), multi-member, non-owner (roster visible,
    no manage affordances -> LockNote "Only the owner can change roles.").

app/(tabs)/scan.tsx           default Scan         (design: Scan.jsx)
  - <CameraView> viewfinder with barcodeScannerSettings={{ barcodeTypes:['qr'] }} and onBarcodeScanned.
    Guard against repeat scans (a ref/flag). On scan: classifyScan(value, boxes.map(b=>b.id)).
  - Result states (match the design's four):
      thisMove  -> brief confirm then router.push(`/box/${boxId}`)
      otherMove -> card "This box is in {moveName}" + "Jump to it"
      noAccess  -> "You don't have access to this box. Ask the owner to invite you."
      unknown   -> "That code isn't part of this move."
  - Provide two demo buttons that feed DEMO_OTHER_MOVE / DEMO_NO_ACCESS into the same handler so all
    states are reachable without a second physical code. Works for Viewers too.
  - Permission denied -> friendly request UI + Linking.openSettings().

app/qr/[id].tsx               default QRScreen     (design: App.jsx QROverlay) — modal
  params: { id }. Full-screen on cream: close (X) top-right (router.back()),
  a color dot (boxColor(box.color)), "Box #{number}" (Fredoka), "{name} · {room}",
  a white rounded card containing <QRCode value={encodeBoxQR(id)} size={232} /> (react-native-qrcode-svg),
  and the line "Hold steady — anyone on the move can scan to open it."
```

### expo-camera quick reference (SDK 52)
```ts
import { CameraView, useCameraPermissions } from 'expo-camera';
const [permission, requestPermission] = useCameraPermissions();
// capture:  const ref = useRef<CameraView>(null); const pic = await ref.current?.takePictureAsync({ quality: 0.6 });  pic?.uri
// scan:     <CameraView barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => ...} style={StyleSheet.absoluteFill} />
```
If `!permission?.granted` show a request UI (call `requestPermission()`); if denied, `Linking.openSettings()`.

---

## 10. Definition of done (per file)

- Exists at the exact path, default-or-named export matching §8/§9.
- Strict TypeScript, no `any` (or a justified, narrow one). Imports resolve via `@/`.
- Visually faithful to the design file (colors, spacing, radii, shadows, copy).
- Pressables have a pressed state; tap targets ≥ 44px; text uses the theme type roles.
- No console errors of intent (don't leave TODOs that break rendering).
