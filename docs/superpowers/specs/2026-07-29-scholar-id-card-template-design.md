# Scholar ID Card Template Management — Design

## 1. Goal

Replace the hardcoded scholar ID card in `qr_code_screen.dart` with a
dynamic, admin-configurable, two-sided flip card: the admin uploads
front/back background art, a mayor's name + signature + two logo images,
and activates that as the live template; every scholar's own app then
renders their ID card (photo, name, school, program, QR, address, DOB,
emergency contact, mayor's name/signature) on top of that template, with a
tap-to-flip interaction between front and back.

## 2. Scope

- **Scholar app only** for card rendering/viewing/flip/download-share.
  Admin's role is limited to managing the template; there is no admin-side
  bulk export/print in this scope (confirmed with product owner).
- **New, simple emergency-contact fields** on the scholar's own record
  (`emergencyContactName`, `emergencyContactPhone`), scholar-editable —
  not sourced from the separate BFCSP application's `guardianName`/
  `guardianContact` fields, since many scholars (bulk-imported, legacy)
  have no application record at all.
- Font/color/size styling of the dynamic data fields (name, address, etc.)
  is **not** admin-configurable in this pass — only the background images,
  logos, and mayor's name/signature are swappable. Matches the reference
  design's typography; keeps scope bounded (YAGNI — nothing in the request
  asked for a font/color editor).

## 3. Reference layout (from the two provided flattened images)

Coordinates below are **relative to card width/height** (0–100%), read off
the two reference images by eye — not exact PSD pixel values (the PSD
couldn't be attached; percentage-based positioning is the correct approach
for a Flutter widget that must render at arbitrary screen sizes anyway).
These are starting values, expected to be nudged during implementation by
visual comparison against the reference images.

**Front:**
| Element | x | y | Notes |
|---|---|---|---|
| Two circular seals (top-left) | 0–22% | 0–25% | sits in the orange diagonal header |
| "Republic of the Philippines / CITY GOVT..." | 25–55% | 3–18% | |
| Program title (diagonal, top-right) | 45–98% | 5–30% | e.g. "BRIDGING FUTURES SCHOLARSHIP PROGRAM" — comes from the template, not hardcoded copy (see §4) |
| Scholar photo (circle) | 3–33% | 18–92% | left third of the card |
| Scholar name | 38–98% | 33–52% | two-tone (first/middle line + last-name line, per reference) |
| School + program | 38–98% | 52–68% | |
| Status banner (e.g. "CITY SCHOLAR") | 33–98% | 68–82% | |
| Secondary logo (bottom-left) | 2–32% | 88–100% | e.g. "MAAYOS NA BAYAN SIGURADO" |
| Mayor's signature + name (bottom-right) | 68–98% | 82–100% | |

**Back:**
| Element | x | y | Notes |
|---|---|---|---|
| "PERSONAL INFORMATION" header | 45–98% | 24–32% | |
| Address | 45–98% | 33–42% | |
| Date of birth | 45–98% | 43–52% | |
| Emergency contact (name + phone) | 45–98% | 53–70% | new fields, §5 |
| Scholar's own signature + name | 45–98% | 74–92% | see §4 open question |
| QR code | 2–45% | 82–100% | the solid blue placeholder box in the reference — **confirm this assumption during implementation** |

## 4. Open items to confirm during implementation (not blocking the plan)

- The reference back image shows a signature line under the scholar's own
  printed name — scholar-ui11 doesn't currently capture a signature image
  anywhere. For v1, render the scholar's typed full name in a
  script/cursive font as a stand-in (no actual signature capture feature);
  flag as a possible future enhancement, not part of this plan.
- The front image's diagonal program-title text ("BRIDGING FUTURES...")
  and the orange "CITY SCHOLAR" banner text are almost certainly meant to
  be part of the **background image itself** (baked into what the admin
  uploads), not separately overlaid dynamic text — confirm this reading
  when building the front-layer widget; only the seals/photo/name/school/
  program/logo/mayor fields are true dynamic overlays.

## 5. Firestore schema

**New singleton doc** `system_config/scholarIdCardTemplate` (revives the
already-built-but-currently-unused `system_config` Firestore pattern —
`getSystemSettings`/`updateSystemConfig` in `backend/functions/src/http/systemSettings.js`
already implement the single-doc, merge-write, audit-logged shape this
needs; `SystemSettings.jsx` just isn't wired to it today for the general
config tab):

```
{
  frontBackgroundUrl: string,
  frontAspectRatio: number,   // width/height, captured at upload time so the
  backBackgroundUrl: string,  // card widget never has to guess/distort a
  backAspectRatio: number,    // differently-shaped future template
  mayorName: string,
  mayorSignatureUrl: string,
  primaryLogoUrl: string,     // e.g. the mayor's-office/campaign logo
  secondaryLogoUrl: string,   // e.g. an additional seal/logo slot
  isActive: boolean,
  updatedAt: timestamp,
  updatedBy: string,
}
```

**New fields on each scholar's own `users/{uid}` doc:**
- `emergencyContactName: string | null`
- `emergencyContactPhone: string | null`

Both nullable/optional, scholar-editable, following the same pattern as
existing scholar-editable profile fields (`houseNo`/`street`/etc.).

## 6. Admin UI

New "ID Card Template" section (own page, or a tab alongside the existing
System Settings tabs — implementer's call, matching whichever fits the
existing nav better):
- Four image upload pickers (front background, back background, mayor's
  signature, and the two logos — five total image slots) reusing the
  existing Cloudinary upload pattern already used by Announcements/Messages
  (`cloudinaryUpload.js`'s `uploadFile`/`isFileSizeAllowed`).
- A text input for the mayor's name.
- On front/back background upload, compute and store `frontAspectRatio`/
  `backAspectRatio` from the selected image's natural dimensions (read via
  the browser's `Image` object) before/alongside the Cloudinary upload.
- A preview of the current (saved but not-yet-active, or currently active)
  template.
- An "Activate" action that writes the doc above via `updateSystemConfig`
  (extending, not replacing, that existing endpoint/wrapper).

## 7. Scholar app — the card

Extends `_ScholarshipIdCard` in `scholar-ui11/lib/features/qr_code/screens/qr_code_screen.dart`
(currently a single hardcoded front side) into a two-sided flip card:
- Fetch the active `system_config/scholarIdCardTemplate` doc once (a simple
  provider, not a live stream — the template changes rarely and a scholar
  can just re-open the screen to see an update).
- Front and back are each a `Stack`: template background `Image.network` at
  the base (using the stored aspect ratio so the card frame itself is never
  distorted), then `Positioned`/`FractionallySizedBox`-based overlays for
  each dynamic field per §3's relative coordinates.
- Reuses the existing `profileImageProvider()` (photo), `qrDisplayData`
  (QR), and `fullAddress`/`age`/`dateOfBirth` (back side) — no new data
  plumbing needed beyond the two new emergency-contact fields.
- Tap-to-flip: a 3D Y-axis rotation (`AnimationController` driving a
  `Transform` with a `Matrix4` perspective + `rotationY`, ~400ms,
  `Curves.easeInOut`), switching which side's `Stack` is visible partway
  through the rotation (standard "card flip" technique — front visible for
  rotation angle in [0°, 90°), back visible in [90°, 180°], mirrored back
  for the return flip).
- Existing download/share-as-PNG (`RepaintBoundary` capture) stays,
  capturing whichever side is currently facing the viewer.

## 8. Scholar input for missing emergency contact info

When `emergencyContactName`/`emergencyContactPhone` are empty, show an
inline "Add emergency contact" affordance on the ID card screen (a small
prompt/button opening a short two-field form) — same interaction pattern as
other scholar-editable profile data already in the app. Once filled, the
back of the card reflects it immediately (local state update + Firestore
write, matching how other profile-field edits already work).

## Phasing (for the implementation plan)

1. Backend/schema: extend `updateSystemConfig`/`getSystemSettings` usage
   for the new template doc shape (no new Cloud Function needed — the
   generic endpoints already handle arbitrary config keys); add the two
   new scholar fields to the existing profile-edit write path.
2. Admin UI: the new template management page/tab.
3. Flutter: `StudentModel` additions (2 new fields) → template-fetch
   provider → the flip-card widget itself (front, then back, then the flip
   animation) → the emergency-contact input affordance.
