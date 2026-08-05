# Scholar Import & Account Activation — Design

> Status: proposed, awaiting sign-off before `writing-plans`.

## 1. Goal

Replace the current bulk-scholar-import path with a production-ready workflow:
admin uploads an Excel file → system validates everything and shows a preview
before saving anything → accounts are created with a deterministic temporary
password → the scholar's first login forces a real password change → from
then on the account behaves like a normal, secured Firebase Auth account.

This is **not a greenfield build**. `bulkCreateScholars`
(`backend/functions/src/http/scholarImport.js`) already does Excel-row
parsing, name splitting, scholar-ID sequencing, Firebase Auth account
creation, and chunked client-side import (`admin-ui/src/pages/Scholars.jsx`).
This spec extends that code rather than replacing the architecture.

## 2. Critical finding that shapes this design

`scholar-ui11` **does not use Firebase Auth sign-in at all today.** Login
(`auth_provider.dart`, `login()`) signs in anonymously (only to satisfy
Firestore rules), looks up `users` by `email` via a Firestore query, and
compares the entered password against a plaintext `password` field on the
document with `==`. Registration writes that same plaintext field and never
calls `createUserWithEmailAndPassword`. `bulkCreateScholars` already creates
a real Firebase Auth account + hashed password — but never writes anything to
the Firestore `password` field, so **an admin-imported scholar cannot log in
today** with the credentials the backend generates.

Decision (confirmed with product owner): migrate to real Firebase Auth
sign-in. This is a larger change than "wire up the missing field," but it's
the only option that satisfies "store only the hashed password, never
plaintext in Firestore," and it fixes a real, pre-existing hole:
`firestore.rules` currently allows `allow read, write: if signedIn();` on
`/users/{userId}` with no ownership check — because today's anonymous-auth
model has no real per-user identity to check against. Once login uses real
Firebase Auth, `request.auth.uid` becomes a meaningful identity and the rules
can be tightened to actual per-owner access (§9).

**Migration consequence:** every scholar/applicant who already self-registered
has a Firestore doc with a plaintext password and *no* Firebase Auth account.
Shipping the new login without a backfill locks all of them out (§8.5).

## 3. Firestore schema

Extends the existing `users/{docId}` document (`AppContext.jsx` lines
185-361 map this shape today). New fields are additive; nothing existing is
removed.

| Field | Type | Status | Notes |
|---|---|---|---|
| `firstName`, `middleName`, `lastName`, `suffix` | string | existing | The Excel template now supplies these as three separate columns directly (§6) — no name-splitting heuristic needed for the primary path. `splitName()`/`SURNAME_PARTICLES` stays as a documented fallback only for legacy files that still use a single "Full Name" column. **No new `fullName` field** — every report/list/search already reads split names; adding a parallel field would fork the data model. |
| `email` | string | existing | lowercased |
| `schoolName`, `academicProgram` | string | existing | (admin-ui aliases these `school`/`program` on the mapped object) |
| `scholarId` | string `YYYY-NNNNN` | existing | auto-generated via `nextScholarIdSeq`, OR admin-supplied (new: validated for uniqueness, see §6) |
| `totalScholarshipSemesters` | number | **new** | cap on how many semesters this scholar's award covers; no current equivalent (today only a global 8-semester auto-graduation rule with a `gradExempt` override exists) |
| `semestersUsed` / `semestersCompleted` | number | existing, **reused** | this *is* "Active Scholarship Semesters" — already tracked and driving auto-graduation/Reports. Do not add a parallel `activeScholarshipSemesters` field. |
| `grantSchoolYear` | string `"YYYY-YYYY"` | **new** | computed by the algorithm in §4; the precise value the admin sees and the spec's examples describe |
| `yearAwarded` | number | existing, **derived** | kept for backward compat, set to `Number(grantSchoolYear.split('-')[0])` — replaces the old rough `computeGrantYear` approximation |
| `uid` | string | **new** | Firebase Auth UID. For accounts created from now on, `uid === doc.id`. Legacy scholars (migrated in §8.5) keep their old app-generated doc id, so `uid` is the only reliable cross-reference — **security rules and any code that checks "is this my doc" must compare `resource.data.uid == request.auth.uid`, never `resource.id`.** |
| `mustChangePassword` | boolean | **new** | `true` on creation by import; `false` for normal self-registration (the scholar already chose their own password) |
| `activatedAt` | Timestamp \| null | **new** | set when `mustChangePassword` transitions `true → false` |
| `lastLogin` | Timestamp \| null | **new** | set by the client immediately after a successful sign-in (see §8.4) |
| `passwordChangedAt` | Timestamp \| null | **new** | set alongside `activatedAt`, and again on any later voluntary password change |
| account "disabled" | Firebase Auth `disabled: boolean` | **new concept, not a Firestore field** | source of truth is Firebase Auth itself — see §5 |
| `adminStatus`, `applicationStatus`, `scholarshipStatus`, `status` | string | existing, **untouched** | scholarship *lifecycle* (pending/active/on-hold/graduated/terminated) — a different axis from account access. Do not conflate with the new disabled/active-account concept. |
| `createdAt`, `createdBy`, `source` | existing | unchanged |

## 4. Scholarship Year Computation Algorithm

Input: current school year start (`currentYearStart`, e.g. `2026`), current
semester index (`1` or `2`), and `activeScholarshipSemesters` (`N`, the total
count of semesters the scholar has already been active — the *current* term
counts as one of them). Step backward `N - 1` times from the current term;
each step moves 2nd→1st sem of the same year, or 1st sem→2nd sem of the
previous year:

```js
// backend/functions/src/utils/scholarshipYear.js
function computeGrantSchoolYear(currentYearStart, currentSemesterIndex, activeSemesters) {
  let yearStart = currentYearStart;
  let semIndex = currentSemesterIndex; // 1 or 2
  const steps = Math.max(0, (Number(activeSemesters) || 1) - 1);

  for (let i = 0; i < steps; i++) {
    if (semIndex === 2) {
      semIndex = 1;
    } else {
      semIndex = 2;
      yearStart -= 1;
    }
  }

  return `${yearStart}-${yearStart + 1}`;
}
```

Verified against the spec's worked example: current `2026-2027`, 1st Sem
(`yearStart=2026, semIndex=1`), `N=4` → 3 steps back → `(2026,1)→(2025,2)→
(2025,1)→(2024,2)` → `"2024-2025"`. Matches exactly.

`N ≤ 1` → 0 steps → grant year is the current school year (a scholar in
their first active semester). Import validation (§6) rejects
`activeScholarshipSemesters < 1`.

"Current school year + semester" is read from the *existing* active-flag
model in `school_years` (`AppContext.jsx`: the doc with `isActive: true`, then
its `semesters` array entry with `isActive: true`) — not the separate,
currently-unused `backend/functions/src/http/schoolYears.js` subcollection
model. (That module is orphaned dead code; flagging it but out of scope here.)

## 5. Temporary Password Generator

```js
// backend/functions/src/utils/temporaryPassword.js
function normalizeSurname(lastName) {
  return String(lastName || '')
    .normalize('NFD')            // decompose accented letters, e.g. "é" -> "e" + combining accent
    .replace(/[^a-zA-Z]/g, '')   // strip everything that isn't a plain letter: the
                                  // now-detached accents, spaces, punctuation, digits
    .toLowerCase();
}

function generateTemporaryPassword(lastName, grantSchoolYear) {
  const surname = normalizeSurname(lastName) || 'scholar';
  const startYear = String(grantSchoolYear).split('-')[0];
  return `${surname}@${startYear}`;
}
```

Verified: "Juan Dela Cruz" → `splitName` (existing, unchanged) → lastName
`"Dela Cruz"` → `"delacruz@2024"`. "Maria Santos" → `"santos@2023"`. Matches
both worked examples exactly.

This **replaces** `makePassword()`/`PASSWORD_SUFFIX` in `scholarImport.js`.
Note the new format is all-lowercase + digits + one `@` — it does **not**
satisfy `backend/functions/src/utils/passwordValidation.js`'s upper+lower
complexity policy. Resolution: that policy applies to passwords a *user*
chooses (the real new password set during the forced first-change, §8.3);
the admin-generated temp password is exempt from it and only needs to clear
Firebase Auth's own hard 6-character minimum, which it does by a wide margin
(9+ chars in every realistic case).

Collisions (two scholars, same surname, same grant year → identical temp
password) are expected and harmless: passwords aren't required to be
globally unique, each account is a distinct email/UID, and the password is
single-use by design (§8.3 forces an immediate change).

## 6. Excel Import & Validation (Preview Before Import)

**Template columns** (final, confirmed): `Scholar ID` (optional,
auto-generated if blank), `First Name`, `Middle Name` (optional), `Last
Name`, `Email`, `School`, `Program`, `Year Level`, `Status`, `Total
Scholarship Semesters`, `Active Scholarship Semesters`. This replaces the
single `Full Name` column in the existing template
(`Scholars.jsx` `handleDownloadTemplate`) with three explicit name columns —
no name-splitting heuristic needed for files built on this template.
`Year Level` and `Status` (`Active`/`On-Hold`) are unchanged from today's
template/backend handling.

**New client-side validation pass**, before any network call — a pure,
testable function following this session's established pattern:

```js
// admin-ui/src/utils/scholarImportValidation.js
export function validateImportRows(rows, { existingEmails, existingScholarIds }) {
  const seenEmails = new Set();
  const seenScholarIds = new Set();
  const seenNameSchool = new Set();

  return rows.map((row, index) => {
    const errors = [];
    const warnings = [];
    const email = (row.Email || '').trim().toLowerCase();
    const scholarId = (row['Scholar ID'] || '').trim();
    const firstName = (row['First Name'] || '').trim();
    const lastName = (row['Last Name'] || '').trim();
    const nameSchoolKey = `${firstName.toLowerCase()} ${lastName.toLowerCase()}::${(row.School || '').trim().toLowerCase()}`;

    if (!firstName) errors.push('Missing First Name');
    if (!lastName) errors.push('Missing Last Name');
    if (!email) errors.push('Missing Email');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format');
    if (!row.School) errors.push('Missing School');
    if (!row.Program) errors.push('Missing Program');
    if (!row['Year Level']) errors.push('Missing Year Level');
    if (Number(row['Active Scholarship Semesters']) < 1) errors.push('Active Scholarship Semesters must be at least 1');
    if (Number(row['Total Scholarship Semesters']) < Number(row['Active Scholarship Semesters'])) {
      errors.push('Total Scholarship Semesters must be >= Active Scholarship Semesters');
    }

    if (email && existingEmails.has(email)) errors.push('Email already has an account');
    if (email && seenEmails.has(email)) errors.push('Duplicate email within this file');
    if (scholarId && existingScholarIds.has(scholarId)) errors.push('Scholar ID already exists');
    if (scholarId && seenScholarIds.has(scholarId)) errors.push('Duplicate Scholar ID within this file');
    if (seenNameSchool.has(nameSchoolKey)) warnings.push('Possible duplicate: same name + school already in this file');

    seenEmails.add(email);
    seenScholarIds.add(scholarId);
    seenNameSchool.add(nameSchoolKey);

    return { index, row, errors, warnings, valid: errors.length === 0 };
  });
}
```

`existingEmails`/`existingScholarIds` are built client-side from
`applicants` — already loaded reactively into `AppContext` — so this needs
**no new backend endpoint** for the preview step itself. Errors block a row
from import; warnings surface but don't block (admin can still choose to
import, e.g. two real people can share a name and school).

**Admin UI**: the "Import Scholars" flow changes from "pick file → single
confirm dialog" to "pick file → preview table (one row per Excel row, colored
by error/warning/ok, with the reason text) → 'Create Accounts' button
enabled only when at least one row is valid." This replaces the immediate
`Swal.fire({title:'Create scholar accounts?'...})` confirm in
`handleFileChange` with a real preview component.

**Backend** (`bulkCreateScholars`) still re-validates independently (never
trust client-side validation for a server mutation) — the duplicate-email
`auth.getUserByEmail` check stays, plus a new duplicate-scholarId check
against Firestore before creating each account.

## 7. `bulkCreateScholars` rewrite

Same chunked-request shape and response contract
(`{created, skipped, failed, total, results}`) — the client's chunking loop
in `Scholars.jsx` doesn't need to change. Per-row logic changes:

1. Read `First Name` / `Middle Name` / `Last Name` directly as three columns
   (`pick(row, 'First Name', 'Given Name')` etc., same fuzzy-header-matching
   convention as today) instead of splitting a single `Full Name` cell.
   `splitName()`/`SURNAME_PARTICLES` is kept, but only as a fallback for a
   row that has a `Full Name` column and no `First Name`/`Last Name` columns
   (legacy file support).
2. Look up current school year + semester (from `school_years`, §4) once per
   invocation (not per row).
3. `grantSchoolYear = computeGrantSchoolYear(currentYearStart, currentSemesterIndex, activeScholarshipSemesters)`
4. `password = generateTemporaryPassword(lastName, grantSchoolYear)`
5. Duplicate scholarId check (new): if the row supplies a Scholar ID, query
   for an existing doc with that `scholarId`; fail the row if found.
6. `auth.createUser({ email, password, displayName: \`${firstName} ${lastName}\`, emailVerified: true })` (unchanged shape)
7. Firestore doc gets the new fields: `uid`, `totalScholarshipSemesters`,
   `grantSchoolYear`, `yearAwarded` (derived), `mustChangePassword: true`,
   `activatedAt: null`, `lastLogin: null`, `passwordChangedAt: null`, plus
   all existing fields as today (including `yearLevel`/`adminStatus` from
   `Year Level`/`Status`, unchanged from the current implementation).
8. Response's per-row `created` entry still includes the plaintext temp
   `password` **in the HTTP response only** (so the admin can download the
   credentials sheet) — never persisted to Firestore.

## 8. Authentication Flow

### 8.1 Import → account creation (admin side)
Covered by §7. Firebase Auth now holds the only copy of the password (hashed
by Firebase); Firestore never sees it.

### 8.2 First login
`scholar-ui11` login screen calls `FirebaseAuth.instance
.signInWithEmailAndPassword(email, password)` (**new** — replaces the
anonymous-auth + Firestore-query + plaintext-compare path). On success,
fetch `users/{FirebaseAuth.instance.currentUser.uid}` **by document ID**
directly (cheaper and simpler than the current email-query lookup — but
only works going forward; see §8.5 for why legacy docs need `uid` backfilled
to their *existing* doc id, not renamed).

Firebase Auth's `disabled` flag is checked automatically by Auth itself at
sign-in (`auth/user-disabled` error) — "prevent login if disabled" needs no
custom code.

### 8.3 Forced password change
If the fetched doc has `mustChangePassword == true`, the router
(`app_router.dart`) redirects to a new `ChangePasswordScreen` before any
other route is reachable (a redirect guard, same shape as any existing
gated-route check in that file). The screen collects current password / new
password / confirm, and:

```dart
final cred = EmailAuthProvider.credential(email: email, password: currentPassword);
await FirebaseAuth.instance.currentUser!.reauthenticateWithCredential(cred);
await FirebaseAuth.instance.currentUser!.updatePassword(newPassword);
await usersCollection.doc(uid).update({
  'mustChangePassword': false,
  'activatedAt': FieldValue.serverTimestamp(),
  'passwordChangedAt': FieldValue.serverTimestamp(),
});
```

The *new* password (chosen by the scholar) goes through the app's real
complexity policy (this is the point where that policy actually matters —
see §5). Reauthentication before `updatePassword` is required by Firebase
Auth for a recent-login-sensitive operation and doubles as re-verifying the
temp password one more time.

### 8.4 Normal login (post-activation)
Same `signInWithEmailAndPassword` + doc fetch by uid; `mustChangePassword`
is false so the app proceeds straight in. Client writes
`lastLogin: FieldValue.serverTimestamp()` right after the doc fetch succeeds.

### 8.5 Backfill migration for existing scholars/applicants (required, not optional)
A one-time script (`backend/functions/scripts/migrateLegacyPasswordsToAuth.js`,
alongside the existing `seedEmulator.js`/`smokeCheck.js` scripts) that, for
every `users` doc with a non-empty plaintext `password` field and no `uid`:
creates a Firebase Auth account using that **existing** plaintext password
(so nobody is forced to change a working password they already know),
records the returned `uid` on the *existing* doc (doc id is left unchanged —
renaming it would break every reference keyed off the old id, e.g.
`enrolledSemesters`, chat threads, notifications), sets
`mustChangePassword: false` (they already "activated" long ago), and clears
the plaintext `password` field. Must run to completion before the new login
code is shipped to production, or every existing user is locked out on day one.

**Hard verification gate before §9 ships:** the script's final step queries
`users` for `where('uid', '==', null)` (or missing) — the count **must be
zero** before the security-rules deploy in §9 is allowed to proceed. If any
docs remain (a row that failed migration, e.g. an email already claimed by
a different Auth account), they must be resolved individually and re-checked
— §9's rules are not deployed while this count is nonzero, since any doc
without `uid` would fail the new ownership check outright and lock that
scholar out.

### 8.6 Self-registration (applicants)
Currently writes a Firestore doc with a plaintext password and no Auth
account — same gap as scholar login. Registration moves to
`FirebaseAuth.instance.createUserWithEmailAndPassword(...)` client-side
(normal Firebase usage — this path doesn't need Admin SDK since applicants
set their own password), doc id becomes the returned uid, `uid` field set to
match, `mustChangePassword: false`.

## 9. Firestore Security Rules

Current `/users/{userId}` rule is `allow read, write: if signedIn();` — any
signed-in (including anonymous) session, no ownership check.

**Correction discovered during Task 14 (2026-07-29):** the obvious design —
gate admin/staff access on `isAdminOrStaff()` (checks `request.auth.token.role`)
— would have broken the admin panel outright. The admin panel signs in to
Firebase **anonymously** (confirmed in §2/§5's research and unchanged by this
whole plan — migrating the admin panel's own auth model is explicitly out of
scope, same as the existing code comment on `bulkCreateScholars` already
flags). An anonymous session has no custom claims at all, so `isAdminOrStaff()`
is always `false` for it — the rule below would make every admin-side write
(status changes, grades, financial fields, anything outside the narrow
self-service allowlist) fail immediately upon deploy.

The correct distinction is **anonymous vs. real** sessions, using Firebase
Auth's standard `request.auth.token.firebase.sign_in_provider` claim (`'anonymous'`
for anonymous sign-in, `'password'` for real email/password sign-in — this is
a well-established Firestore-rules pattern, not something specific to this
project). This preserves 100% of today's admin-panel behavior (still
anonymous, still unrestricted — zero regression risk, since we cannot safely
tell an anonymous *admin* session apart from any other anonymous session
without also migrating admin auth, which is out of scope) while adding a
real restriction for any session that authenticated with real credentials
(a scholar/applicant, post this plan) so *that* session can only touch its
own document:

```
function isAnonymous() {
  return signedIn() && request.auth.token.firebase.sign_in_provider == 'anonymous';
}

match /users/{userId} {
  allow read: if signedIn();
  allow create: if isAnonymous() || request.resource.data.uid == request.auth.uid;
  allow update: if isAnonymous()
             || (resource.data.uid == request.auth.uid
                 && request.resource.data.diff(resource.data).affectedKeys()
                      .hasOnly(['mustChangePassword','passwordChangedAt','activatedAt','lastLogin',
                                'houseNo','street','barangay','city','province','gender','contactNumber',
                                'profilePicture','celebrationSeen',
                                'grades','cogSubmissions','corSubmissions','requirements']));
  allow delete: if isAnonymous();
}
```

**Second correction, found during Task 14's own implementation (2026-07-29):**
cross-referencing the update allowlist and the self-only read restriction
against the actual shipped `scholar-ui11` app surfaced two more gaps:

1. **Missing self-service write fields.** The live app already writes
   `grades`, `cogSubmissions`, `corSubmissions`, and `requirements` to a
   scholar's own doc (`grades_provider.dart`, `scholar_firestore_service.dart`)
   — none were on the original allowlist, so every future grade/COG/COR/
   requirement save by a real (non-anonymous) scholar session would have been
   denied. Added to the allowlist above; award-integrity fields (`scholarId`,
   `amountGranted`, `status`, etc.) deliberately remain off it.
2. **Self-only reads break group chat.** `messaging_provider.dart`'s member
   lookup (`fetchUsersByIds`, a `whereIn(documentId)` query) reads OTHER
   members' docs for name/school/program display. Firestore denies an
   **entire** query if any one of its possible results would be denied by the
   rules — so a self-only read rule would break every multi-member group chat
   the moment a real scholar session tried it. Firestore also has no
   field-level read redaction, so there's no way to expose just the
   display-safe fields without a bigger restructuring (e.g. moving public
   display fields to the already-defined-but-unused `/profiles/{userId}`
   collection) — out of scope for this plan. Reads are relaxed back to
   `signedIn()` (any real-or-anonymous session), matching today's behavior
   exactly. This is an acceptable trade because the read-tightening's
   original motivation — preventing one session from reading another
   scholar's plaintext password — no longer applies: that field is gone from
   Firestore entirely as of this plan. Write tightening (the actual
   award-integrity protection) is unaffected by this relaxation.

Self-updates by a real (non-anonymous) scholar/applicant session are
allowlisted to profile/activation fields only — they can't rewrite their own
`scholarId`, `status`, `amountGranted`, etc. This is a real behavior change
from today's wide-open rule for *real* sessions only; anonymous (today's
admin panel) sessions are completely unaffected. Must still ship only after
§8's migration (every doc has a real `uid`) is verified complete — not before.

## 10. Sequence Diagram

```
Admin (React)                Cloud Function              Firebase Auth        Firestore
     |--- upload Excel -------->|                              |                  |
     |<-- preview (client-side validation vs existingEmails/Ids) --------------|
     |--- confirm, chunk 1 ---->|                              |                  |
     |                          |--- getUserByEmail (dup?) --->|                  |
     |                          |--- query scholarId dup ---------------------->|
     |                          |--- createUser(email,tempPwd)--->|              |
     |                          |<---------------- uid -----------|              |
     |                          |--- set users/{uid} {..., mustChangePassword:true} ------->|
     |<-- {created, results incl. temp password} --|                              |
     |--- download credentials sheet (offline) --------------------------------->|

Scholar (Flutter)                                    Firebase Auth        Firestore
     |--- signInWithEmailAndPassword(email,tempPwd) ---->|                        |
     |<----------------------- uid -----------------------|                        |
     |--- get users/{uid} -------------------------------------------------->|
     |<-- doc { mustChangePassword: true, ... } -----------------------------|
     |--- (router redirects to ChangePasswordScreen, blocks everything else) |
     |--- reauthenticate + updatePassword(newPwd) ------->|                        |
     |--- update users/{uid} {mustChangePassword:false, activatedAt, passwordChangedAt} -->|
     |--- (normal app access) ---|
```

## 11. Flutter Architecture (files touched)

- `scholar-ui11/lib/features/auth/providers/auth_provider.dart` — replace
  `login()`'s anonymous-auth+query+plaintext-compare with
  `signInWithEmailAndPassword` + doc-by-uid fetch; keep the existing
  `_listenToStudentDoc`/`_isRemovedData` live-listener pattern unchanged
  (still valid, just keyed by uid now).
- `scholar-ui11/lib/features/auth/screens/change_password_screen.dart` — **new**,
  current/new/confirm password form per §8.3.
- `scholar-ui11/lib/features/auth/screens/registration_screen.dart` — switch
  to `createUserWithEmailAndPassword` (§8.6).
- `scholar-ui11/lib/core/router/app_router.dart` — add the
  `mustChangePassword` redirect guard alongside whatever existing gated-route
  pattern is already there (e.g. email verification, if present).
- `scholar-ui11/lib/core/models/student_model.dart` — drop the `password`
  field from the model entirely once the migration (§8.5) completes; add
  `uid`, `mustChangePassword`, `activatedAt`, `lastLogin`,
  `passwordChangedAt`, `totalScholarshipSemesters`, `grantSchoolYear`.

This keeps the existing pragmatic provider+service structure (no new
architectural layers introduced just for this feature — see §13).

## 12. React Admin Architecture (files touched)

- `admin-ui/src/pages/Scholars.jsx` — `handleFileChange` split into
  "parse + validate + show preview" and "confirm + chunked create" (§6);
  new preview table component (can live inline in this file, following the
  existing single-page-per-feature convention, or as
  `admin-ui/src/components/scholars/ImportPreviewTable.jsx` if it grows past
  ~100 lines — matches the "split when a file gets unwieldy" guidance).
- `admin-ui/src/utils/scholarImportValidation.js` — **new**, pure function
  from §6 (unit-testable, no React/Firebase dependency).
- New admin features, extending the existing Scholars page: **View Active /
  Disabled Accounts** (filter by Auth `disabled` flag, mirrored into
  Firestore as a read-only `accountDisabled` convenience field synced by the
  Cloud Functions that toggle it — see below), **Reset Password** and
  **Generate New Temporary Password** (both call the *already-existing*
  `resetUserPassword({targetUid, newPassword})` in `backendApi.js` —
  "regenerate" just calls `generateTemporaryPassword` again with the
  scholar's current `grantSchoolYear` and passes the result to that same
  function; no new backend endpoint needed for reset, only a small new
  `disableUserAccount`/`enableUserAccount` Cloud Function for the
  active/disabled toggle, using `auth.updateUser(uid, {disabled})`).
- **Export Scholars** / **Search Scholars** — largely already exist in
  `Scholars.jsx` (Excel export via `xlsx`, search input); extend the export
  column set with the new fields, no architectural change.

## 13. Repository Pattern / Clean Architecture

The codebase does not use strict clean-architecture layering today — Flutter
providers call `ScholarFirestoreService` directly, and the React admin calls
Firestore/Cloud Functions directly from page components via
`AppContext`/`backendApi.js`. This feature **follows the existing pattern
rather than introducing a new one**: no new repository/use-case layers, just
new functions in the existing service/util modules named in §11-12. Adding a
formal repository pattern here would be inconsistent with the rest of the
codebase and outside what this feature needs (YAGNI).

## 14. Error Handling

- Import preview: all validation errors are collected and shown per-row
  before any write — this *is* the "display all errors before saving"
  requirement; nothing partial is saved from an invalid row.
- `bulkCreateScholars`: per-row try/catch already exists (each row's failure
  doesn't abort the batch) — unchanged, just with two new failure modes
  (duplicate scholarId, grant-year computation failure if no active school
  year is configured — surfaced as a row failure with a clear reason, not a
  500).
- Login: `signInWithEmailAndPassword` failures (`wrong-password`,
  `user-not-found`, `user-disabled`, `too-many-requests`) map to specific
  user-facing messages instead of a generic "login failed."
- `ChangePasswordScreen`: `reauthenticateWithCredential` failure (wrong
  current password) shown inline, does not consume the "must change" gate
  (user can retry).
- Migration script (§8.5): logs and continues past individual failures
  (a bad legacy doc shouldn't abort the whole backfill); prints a summary
  and a list of any doc ids needing manual follow-up.

## 15. Best Practices / Security Notes

- Never store plaintext passwords in Firestore, at rest or in transit
  through it — the only place a plaintext temp password ever appears is the
  one-time HTTP response to the admin's import call and the credentials
  Excel sheet it downloads.
- `ADMIN_IMPORT_KEY` shared-secret gate on `bulkCreateScholars` stays as-is
  (out of scope for this change — a real admin-identity-based Cloud Function
  auth model is a separate, bigger concern already flagged by the existing
  code comment).
- Firestore rules tightening (§9) must deploy *after* the backfill (§8.5)
  completes, not before — deploying it early would lock out every legacy
  user whose doc doesn't have `uid` set yet.
- Rate limiting / abuse: `too-many-requests` from Firebase Auth on repeated
  failed logins is handled natively by Firebase; no custom throttling needed.

## Phasing (for the implementation plan)

1. Backend: §4 (year algorithm), §5 (password generator), §6 (server-side
   revalidation), §7 (`bulkCreateScholars` rewrite) — each independently unit-testable.
2. Admin UI: §6 preview UI, §12 active/disabled + reset/regenerate.
3. Migration: §8.5 backfill script, written and run against production —
   **must reach zero missing-`uid` docs (the hard gate in §8.5) before phase 4 ships.**
4. Flutter: §8.2-8.4 (real login), §8.3 (`ChangePasswordScreen`), §8.6
   (registration) — safe to ship only once phase 3's gate is green, since
   this is what makes every account's login depend on having a `uid`.
5. Security: §9 rules tightening — ships only after phase 4 is live and
   confirmed working (so no legitimate session gets locked out by a rules
   change while still relying on the old assumptions).
