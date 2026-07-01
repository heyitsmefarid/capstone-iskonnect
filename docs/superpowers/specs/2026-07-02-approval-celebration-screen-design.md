# Approval Celebration Screen (Applicant → Scholar)

Date: 2026-07-02
Status: Approved (design)

## Goal

When an applicant is approved by the admin and their account flips from
`applicant` to `scholar`, the scholar app currently swaps `DashboardScreen` in
for `ApplicantDashboardScreen` silently — no acknowledgement at all. This adds
a one-time, full-screen celebration ("Congratulations for being our newly City
Scholar, {Name}!" with confetti/fireworks) that reveals their Total Evaluation
Score and the three component scores (Requirements, Economic, Examination)
before handing off to the normal scholar dashboard.

Visual direction was validated interactively (browser mockups) before this
spec: light/mint background, no trophy icon, rising-rocket fireworks + mixed
confetti, gradient headline text with the scholar's name, then a hero "Total
Evaluation Score" ring followed by three smaller breakdown rings that fill in
one at a time. No "QUALIFIED" chip, no extra body copy beyond the one
headline.

## Decisions

- **Trigger: router redirect, not a widget check.** The existing `GoRouter`
  `redirect` in `app_router.dart` already gates `/splash`, `/login`, etc. This
  adds the same style of rule: once logged in, if the student is a scholar and
  hasn't seen the celebration yet, every route redirects to `/celebration`
  until it's marked seen.
- **`/celebration` is a top-level route, not inside `ShellRoute`.** It must not
  render with the bottom nav bar (`MainShell`) — it's a full-bleed takeover,
  same tier as `/splash` and `/login`.
- **"Seen" is persisted server-side.** A new `celebrationSeen: bool` field on
  the Firestore `users/{id}` doc (mirrored in `StudentModel`) is set once the
  screen finishes. This satisfies "once ever, any device" — a reinstall or new
  device won't replay it, since the flag travels with the Firestore doc, not
  local storage.
- **Auto-advance with an early-out.** The screen plays through automatically
  and then navigates to `/dashboard`; a "Continue" button appears partway
  through so the scholar isn't forced to wait.
- **Missing scores are omitted, not zero-filled.** Each of the three breakdown
  rings only renders if its score exists. The **Total Evaluation Score ring
  only renders when all three exist** — a partial total would be misleading,
  so an incomplete evaluation just shows the three (or fewer) rings it has,
  with no hero total.
- **No new dependencies.** Confetti, fireworks, and the score rings are built
  with plain Flutter (`CustomPainter` for particles, `TweenAnimationBuilder`
  for ring fills) plus the `flutter_animate` package already in `pubspec.yaml`
  — no new packages needed.

## Data contract additions — `users/{id}`

Two fields the admin already computes but never wrote are now synced, plus
one new flag:

```
users/{id} = {
  ...existing fields...
  examScore:          number | null,   // already synced today
  requirementsScore:  number | null,   // NEW — was admin-local only
  economicScore:      number | null,   // NEW — was admin-local only
  celebrationSeen:    boolean,         // NEW — defaults false
}
```

`Total Evaluation Score = requirementsScore + economicScore + (examScore * 0.5)`,
rounded, clamped 0–100 — the same formula `Applications.jsx` already uses for
its on-screen total.

## Changes

### 1. `admin-ui/src/context/AppContext.jsx`
- `buildUserDocFromApplicant`: add `requirementsScore: applicant.requirementsScore ?? null`
  and `economicScore: applicant.economicScore ?? null` to the written doc, next
  to the existing `examScore` line, so both scores now reach Firestore.

### 2. `scholar-ui11/lib/core/models/student_model.dart`
- Add fields: `int? requirementsScore`, `int? economicScore`, `double? examScore`,
  `bool celebrationSeen` (default `false`). Wire through the constructor,
  `copyWith`, `toJson`, `fromJson`.
- Add:
  - `bool get hasFullEvaluation => requirementsScore != null && economicScore != null && examScore != null;`
  - `int? get totalEvaluationScore` — null unless `hasFullEvaluation`; otherwise
    the rounded/clamped formula above.

### 3. `scholar-ui11/lib/features/auth/providers/auth_provider.dart`
- `AuthNotifier.markCelebrationSeen()`: sets `celebrationSeen: true` on the
  current student, updates local state/cache, and persists via the existing
  `_saveStudentToFirestoreSafely` (merge write) — mirrors how
  `updateApplicationStatus` already does a scoped field update.

### 4. `scholar-ui11/lib/core/router/app_router.dart`
- New narrow provider (alongside `_authStatusProvider`) that watches
  `currentStudentProvider` and derives only `(isScholar, celebrationSeen)`, so
  the router only rebuilds on the transition that matters — not on every
  grade/attendance update.
- New top-level `GoRoute(path: '/celebration', name: 'celebration', builder: ... CongratulationsScreen())`,
  declared next to `/splash`/`/login` (outside the `ShellRoute`).
- `redirect` logic gains:
  ```
  final isCelebrating = state.matchedLocation == '/celebration';
  final celebrationPending = isScholar && !celebrationSeen;
  ...
  if (isLoggedIn && isLoggingIn) {
    return celebrationPending ? '/celebration' : '/dashboard';
  }
  if (celebrationPending && !isCelebrating) return '/celebration';
  if (!celebrationPending && isCelebrating) return '/dashboard';
  ```
  placed after the existing splash/login/init checks, before the final `return null`.

### 5. New feature folder: `scholar-ui11/lib/features/celebration/`
- **`screens/congratulations_screen.dart`** — orchestrates the sequence:
  1. Phase 1 (~3s): confetti + firework layers running, headline
     `"Congratulations for being\nour newly City Scholar, {fullName}!"`
     (name omitted gracefully if empty) pops in via `flutter_animate`.
  2. Phase 2: "YOUR EVALUATION RESULTS" label, then (if `hasFullEvaluation`)
     the hero Total ring, then the up-to-three breakdown rings that exist,
     each staggered in with `flutter_animate`'s delay.
  3. If **no** scores exist at all, phase 2 is skipped entirely — straight
     from the headline to the Continue button.
  4. A "Continue" button fades in once phase 2 starts; a `Timer` also
     auto-advances a few seconds after the last ring finishes. Both paths call
     one `_finish()` that awaits `markCelebrationSeen()` then
     `context.go('/dashboard')`.
- **`widgets/confetti_layer.dart`** — repeating falling particles
  (`CustomPainter` + single `AnimationController`), colors drawn from
  `AppColors` (primary, secondary, success, teal-ish tones) to match brand.
- **`widgets/firework_layer.dart`** — a handful of scheduled rocket-rise +
  radial-burst particle effects (short-lived `AnimationController`s spawned on
  a `Timer`), same palette.
- **`widgets/score_ring.dart`** — reusable animated ring: `TweenAnimationBuilder`
  drives both the arc fill (`CircularProgressIndicator` or a small custom arc
  painter) and a count-up number, taking `value`, `max`, and `label`. Used for
  both the hero total (larger) and the three breakdown rings (smaller).

## Out of scope

- Re-showing the celebration if a scholar is later terminated and
  re-approved — `celebrationSeen` is a one-way flag; revisiting this is a
  future decision, not part of this change.
- Any change to the interview/ranking rubric flow in `ApplicantEvaluation.jsx`
  — unrelated scoring system, not touched.
- Push notifications or emails about approval — this is purely the in-app
  screen.
