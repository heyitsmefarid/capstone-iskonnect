# Lock Grade Actions Until Enrollment Verified — Design

## Problem

A scholar can add COG, COR, and subject grades in the Flutter app (scholar-ui11
Grades screen) regardless of whether the CED admin has confirmed their
enrollment for the term. There's currently no gate at all — the
`enrollmentStatus` flag the admin can set (via the toggle added in
[Scholars.jsx](../../../admin-ui/src/pages/Scholars.jsx)) doesn't reach the
Flutter app to begin with:

- `mapStudentToApplicant` in [AppContext.jsx](../../../admin-ui/src/context/AppContext.jsx)
  never reads `enrollmentStatus` off the Firestore doc into the admin's
  `applicants` state.
- `buildUserDocFromApplicant` never writes `enrollmentStatus` back to
  Firestore, so the admin's toggle only changes in-memory state — a page
  refresh reverts it, and the Flutter app (which reads the `users` doc
  directly) never sees it.

## Design

### 1. Admin-ui: make `enrollmentStatus` round-trip through Firestore

- `mapStudentToApplicant`: add `enrollmentStatus: student.enrollmentStatus ?? null,`
  to the mapped applicant object.
- `buildUserDocFromApplicant`: add `enrollmentStatus: applicant.enrollmentStatus ?? null,`
  to `docData` so `syncApplicantToFirestore` persists it on every
  `updateApplicant` call, including the toggle button's.

### 2. scholar-ui11: expose the field on `StudentModel`

- Add `final String? enrollmentStatus;` to `StudentModel`, threaded through
  the constructor, `copyWith`, `toJson`, and `fromJson` (`json['enrollmentStatus']?.toString()`),
  matching the existing pattern for other admin-set fields like
  `requirementsScore`.
- Add `bool get isEnrolled => enrollmentStatus == 'Verified';`

### 3. scholar-ui11: gate the 3 speed-dial actions in `grades_screen.dart`

- `_buildSpeedDial` takes the current `student` (already available in
  `_GradesScreenState.build` via `currentStudentProvider`) and passes
  `student.isEnrolled` down to each `_SpeedDialItem` for Add COG, Add COR,
  and Add Subject.
- `_SpeedDialItem` gains an `enabled` flag:
  - `enabled: true` (default/current look): full-color gradient, tap
    navigates as today.
  - `enabled: false`: gradient replaced with a muted grey, label text muted;
    `onTap` shows a snackbar — *"Your enrollment hasn't been verified yet by
    the CED admin."* — instead of navigating, and does not close the speed
    dial.
- The main "+" FAB is unaffected — it always opens/closes the speed dial;
  only the 3 leaf actions are gated.
- No change to the existing St. Augustine COR-exemption logic (the
  `!student.isStAugustine` conditionals elsewhere on the screen) — orthogonal
  to this gate and left as-is.

## Out of scope

- Changing what "enrolled" means beyond the existing `enrollmentStatus`
  field/values already established for the admin toggle.
- Any change to `View COR Storage` / `View COG Storage` (those remain
  read-only views of already-submitted files, not gated).
