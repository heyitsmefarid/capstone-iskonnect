# Scholar Import & Account Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current bulk-scholar-import path with validated preview-before-import, a precise scholarship-year computation, a deterministic temporary password, and a migration of scholar/applicant login to real Firebase Auth with a forced first-login password change — without breaking any currently-working report, list, or auto-graduation logic that depends on today's schema.

**Architecture:** Extends existing code rather than replacing it: `backend/functions/src/http/scholarImport.js` (Cloud Function), `admin-ui/src/pages/Scholars.jsx` (React admin), and `scholar-ui11/lib/features/auth/*` (Flutter) all already exist and are modified in place. New pure/testable utility modules carry the new algorithms.

**Tech Stack:** Node 20 (Cloud Functions, `firebase-admin`/`firebase-functions`), React 19 + Vite (admin-ui), Flutter/Dart + Riverpod + go_router (scholar-ui11), Cloud Firestore, Firebase Auth.

Full design rationale: `docs/superpowers/specs/2026-07-28-scholar-import-account-activation-design.md`.

## Global Constraints

- **No plaintext passwords in Firestore, ever.** The only place a generated temporary password may appear is the HTTP response to the admin's import call and the credentials Excel sheet built from it.
- **Never rename a legacy Firestore doc's id.** Doc id and Firebase Auth `uid` are equal for every account created from now on, but legacy scholars keep their existing doc id — always compare identity via the `uid` *field*, never `resource.id`/`doc.id`, in any new code (rules, Flutter, Cloud Functions).
- **`semestersUsed`/`semestersCompleted` is the canonical field for "active scholarship semesters."** Do not introduce a parallel `activeScholarshipSemesters` Firestore field — it would drift out of sync with the auto-graduation logic and every report that already reads `semestersUsed`.
- **No single `fullName` Firestore field.** Every report/list/search already reads split `firstName`/`middleName`/`lastName`; the Excel template now supplies these as three columns directly, so no name-splitting heuristic is needed for new imports (existing `splitName()` stays only as a fallback for legacy single-column files).
- **Firestore rules tightening (Task 14) must not be deployed until Task 9's migration has run to completion in production and its zero-missing-`uid` verification query is confirmed clean.** Deploying early locks out every legacy account.
- **No new test framework.** Neither `backend/functions` nor `admin-ui` has one configured today. New pure JS/Node logic uses Node's built-in `node --test` + `node:assert/strict` (Node 20, zero new dependencies — matches `package.json`'s `"engines": {"node": "20"}` for the backend and `"type": "module"` for admin-ui). Flutter code uses the existing `flutter_test` setup (see `scholar-ui11/test/features/auth/providers/auth_provider_test.dart` for the established style).
- **Existing `resetUserPassword`/`deactivateUser` (`backend/functions/src/http/userManagement.js`) are not reused as-is.** They're gated by `authenticateRequest` (a real Firebase ID token with an admin/super_admin custom claim), but the admin panel signs in anonymously and never sends an ID token (confirmed: `admin-ui/src/context/AppContext.jsx` only calls `signInAnonymously`, and `backendApi.js` never sets an `Authorization` header) — so those two endpoints are currently unreachable from the admin panel at all. That's a separate, pre-existing gap, out of scope here. New endpoints for scholar password reset/regenerate and enable/disable are added instead, gated the same working way `bulkCreateScholars` already is (`x-admin-key` shared secret).
- **Chunked-import contract is unchanged.** `Scholars.jsx`'s existing chunking loop (`IMPORT_CHUNK_SIZE`) and `bulkCreateScholars`'s `{created, skipped, failed, total, results}` response shape stay exactly as they are — only per-row logic changes.

---

## Phase 1 — Backend algorithms & `bulkCreateScholars` rewrite

### Task 1: Scholarship Year Computation utility

**Files:**
- Create: `backend/functions/src/utils/scholarshipYear.js`
- Test: `backend/functions/src/utils/scholarshipYear.test.js`
- Modify: `backend/functions/package.json` (add `"test": "node --test src/utils"` script)

**Interfaces:**
- Produces: `computeGrantSchoolYear(currentYearStart: number, currentSemesterIndex: 1|2, activeSemesters: number): string` — returns `"YYYY-YYYY"`. Used by Task 4.

- [ ] **Step 1: Write the failing test**

```js
// backend/functions/src/utils/scholarshipYear.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeGrantSchoolYear } = require('./scholarshipYear');

test('worked example from the spec: 2026-2027 1st Sem, 4 active semesters -> 2024-2025', () => {
  assert.equal(computeGrantSchoolYear(2026, 1, 4), '2024-2025');
});

test('second worked example shape: 1 active semester -> current school year unchanged', () => {
  assert.equal(computeGrantSchoolYear(2026, 1, 1), '2026-2027');
});

test('starting from 2nd semester steps back correctly', () => {
  // 2026-2027 2nd Sem, 3 active semesters: (2026,2)->(2026,1)->(2025,2) -> 2025-2026
  assert.equal(computeGrantSchoolYear(2026, 2, 3), '2025-2026');
});

test('activeSemesters <= 1 never steps backward (guards against 0 or negative input)', () => {
  assert.equal(computeGrantSchoolYear(2026, 1, 0), '2026-2027');
  assert.equal(computeGrantSchoolYear(2026, 1, -3), '2026-2027');
});

test('large semester counts step back multiple years', () => {
  // 2026-2027 1st Sem, 8 active semesters -> 7 steps back
  // (2026,1)->(2025,2)->(2025,1)->(2024,2)->(2024,1)->(2023,2)->(2023,1)->(2022,2)
  assert.equal(computeGrantSchoolYear(2026, 1, 8), '2022-2023');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend/functions/src/utils/scholarshipYear.test.js`
Expected: FAIL with "Cannot find module './scholarshipYear'"

- [ ] **Step 3: Write minimal implementation**

```js
// backend/functions/src/utils/scholarshipYear.js
'use strict';

// Steps backward (activeSemesters - 1) terms from the current term. Each step
// moves 2nd sem -> 1st sem of the same year, or 1st sem -> 2nd sem of the
// PREVIOUS year. The current term itself counts as one of activeSemesters,
// so a scholar with exactly 1 active semester needs 0 steps.
function computeGrantSchoolYear(currentYearStart, currentSemesterIndex, activeSemesters) {
  let yearStart = currentYearStart;
  let semIndex = currentSemesterIndex;
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

module.exports = { computeGrantSchoolYear };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend/functions/src/utils/scholarshipYear.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/functions/src/utils/scholarshipYear.js backend/functions/src/utils/scholarshipYear.test.js backend/functions/package.json
git commit -m "feat: add scholarship-year computation algorithm"
```

---

### Task 2: Temporary Password Generator utility

**Files:**
- Create: `backend/functions/src/utils/temporaryPassword.js`
- Test: `backend/functions/src/utils/temporaryPassword.test.js`

**Interfaces:**
- Consumes: nothing (pure function)
- Produces: `generateTemporaryPassword(lastName: string, grantSchoolYear: string): string`. Used by Task 4.

- [ ] **Step 1: Write the failing test**

```js
// backend/functions/src/utils/temporaryPassword.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateTemporaryPassword } = require('./temporaryPassword');

test('worked example: Dela Cruz, 2024-2025 -> delacruz@2024', () => {
  assert.equal(generateTemporaryPassword('Dela Cruz', '2024-2025'), 'delacruz@2024');
});

test('worked example: Santos, 2023-2024 -> santos@2023', () => {
  assert.equal(generateTemporaryPassword('Santos', '2023-2024'), 'santos@2023');
});

test('strips accents', () => {
  assert.equal(generateTemporaryPassword('Peña', '2025-2026'), 'pena@2025');
});

test('strips spaces and punctuation, forces lowercase', () => {
  assert.equal(generateTemporaryPassword("D'Angelo-Reyes", '2025-2026'), 'dangeloreyes@2025');
});

test('falls back to "scholar" when lastName is empty', () => {
  assert.equal(generateTemporaryPassword('', '2025-2026'), 'scholar@2025');
});

test('meets Firebase Auth\'s 6-character minimum for every realistic name', () => {
  assert.ok(generateTemporaryPassword('Li', '2025-2026').length >= 6);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend/functions/src/utils/temporaryPassword.test.js`
Expected: FAIL with "Cannot find module './temporaryPassword'"

- [ ] **Step 3: Write minimal implementation**

```js
// backend/functions/src/utils/temporaryPassword.js
'use strict';

function normalizeSurname(lastName) {
  return String(lastName || '')
    .normalize('NFD')            // decompose accented letters, e.g. "ñ" -> "n" + combining tilde
    .replace(/[^a-zA-Z]/g, '')   // strip everything that isn't a plain letter: the
                                  // now-detached accents, spaces, punctuation, digits
    .toLowerCase();
}

// Deliberately does NOT run through the app's password complexity policy
// (backend/functions/src/utils/passwordValidation.js) — that policy is for
// passwords a scholar CHOOSES during the forced first-change. This temp
// password only needs to clear Firebase Auth's own 6-character minimum,
// which every realistic surname + "@YYYY" clears by a wide margin.
function generateTemporaryPassword(lastName, grantSchoolYear) {
  const surname = normalizeSurname(lastName) || 'scholar';
  const startYear = String(grantSchoolYear).split('-')[0];
  return `${surname}@${startYear}`;
}

module.exports = { generateTemporaryPassword, normalizeSurname };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend/functions/src/utils/temporaryPassword.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/functions/src/utils/temporaryPassword.js backend/functions/src/utils/temporaryPassword.test.js
git commit -m "feat: add deterministic temporary password generator"
```

---

### Task 3: Current school year/semester lookup helper

**Files:**
- Create: `backend/functions/src/utils/currentTerm.js`
- Test: `backend/functions/src/utils/currentTerm.test.js`

**Interfaces:**
- Consumes: a Firestore `db`-like object (only `.collection().where().limit().get()` is used, so a fake object satisfies the test without the emulator)
- Produces: `async getCurrentSchoolYearAndSemester(db): Promise<{yearStart: number, semesterIndex: 1|2} | null>`. Used by Task 4.

This reads the **flat array-of-semesters model** that `admin-ui/src/context/AppContext.jsx` actually uses (`school_years` collection, one doc per year with `isActive` + a nested `semesters` array each with its own `isActive`) — not the separate, currently-unused `backend/functions/src/http/schoolYears.js` subcollection model.

- [ ] **Step 1: Write the failing test**

```js
// backend/functions/src/utils/currentTerm.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { getCurrentSchoolYearAndSemester } = require('./currentTerm');

// Minimal fake matching the .collection().where().limit().get() chain used
// by the implementation — no emulator needed for this pure lookup logic.
function fakeDb(activeYearDoc) {
  return {
    collection: () => ({
      where: () => ({
        limit: () => ({
          get: async () => ({
            empty: !activeYearDoc,
            docs: activeYearDoc ? [{ data: () => activeYearDoc }] : [],
          }),
        }),
      }),
    }),
  };
}

test('returns yearStart + semesterIndex 1 for an active 1st semester', async () => {
  const db = fakeDb({
    startYear: 2026,
    isActive: true,
    semesters: [
      { name: '1st Semester', order: 1, isActive: true },
      { name: '2nd Semester', order: 2, isActive: false },
    ],
  });
  assert.deepEqual(await getCurrentSchoolYearAndSemester(db), { yearStart: 2026, semesterIndex: 1 });
});

test('returns semesterIndex 2 for an active 2nd semester', async () => {
  const db = fakeDb({
    startYear: 2026,
    isActive: true,
    semesters: [
      { name: '1st Semester', order: 1, isActive: false },
      { name: '2nd Semester', order: 2, isActive: true },
    ],
  });
  assert.deepEqual(await getCurrentSchoolYearAndSemester(db), { yearStart: 2026, semesterIndex: 2 });
});

test('returns null when no school year is marked active', async () => {
  assert.equal(await getCurrentSchoolYearAndSemester(fakeDb(null)), null);
});

test('returns null when the active year has no active semester', async () => {
  const db = fakeDb({
    startYear: 2026,
    isActive: true,
    semesters: [{ name: '1st Semester', order: 1, isActive: false }],
  });
  assert.equal(await getCurrentSchoolYearAndSemester(db), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test backend/functions/src/utils/currentTerm.test.js`
Expected: FAIL with "Cannot find module './currentTerm'"

- [ ] **Step 3: Write minimal implementation**

```js
// backend/functions/src/utils/currentTerm.js
'use strict';

async function getCurrentSchoolYearAndSemester(db) {
  const snap = await db.collection('school_years').where('isActive', '==', true).limit(1).get();
  if (snap.empty) return null;

  const yearDoc = snap.docs[0].data();
  const semesters = Array.isArray(yearDoc.semesters) ? yearDoc.semesters : [];
  const activeSemester = semesters.find((s) => s.isActive);
  if (!activeSemester) return null;

  const semesterIndex = Number(activeSemester.order) === 2 ? 2 : 1;
  return { yearStart: Number(yearDoc.startYear), semesterIndex };
}

module.exports = { getCurrentSchoolYearAndSemester };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test backend/functions/src/utils/currentTerm.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/functions/src/utils/currentTerm.js backend/functions/src/utils/currentTerm.test.js
git commit -m "feat: add current school-year/semester lookup helper"
```

---

### Task 4: Rewrite `bulkCreateScholars`

**Files:**
- Modify: `backend/functions/src/http/scholarImport.js`

**Interfaces:**
- Consumes: `computeGrantSchoolYear` (Task 1), `generateTemporaryPassword` (Task 2), `getCurrentSchoolYearAndSemester` (Task 3)
- Produces: same response contract as today — `{created, skipped, failed, total, results}` — consumed unchanged by `Scholars.jsx`'s existing chunking loop.

This task has no new automated test of its own (it's the integration point wiring together Tasks 1-3, each already covered) — verify manually against the Functions emulator per Step 3 below.

- [ ] **Step 1: Read the current file**

Read `backend/functions/src/http/scholarImport.js` in full (230 lines) before editing — the diff below references exact existing line anchors.

- [ ] **Step 2: Replace the password/grant-year logic (lines 17-23, 68-78) with the new utilities**

Remove `SEMESTERS_PER_YEAR`, `PASSWORD_SUFFIX`, `makePassword()`, `computeGrantYear()`. Add at the top of the file:

```js
const { computeGrantSchoolYear } = require('../utils/scholarshipYear');
const { generateTemporaryPassword } = require('../utils/temporaryPassword');
const { getCurrentSchoolYearAndSemester } = require('../utils/currentTerm');
```

- [ ] **Step 3: Read First/Middle/Last Name as three columns, with legacy Full-Name fallback**

Replace the `fullName`/`splitName(fullName)` read (lines 129, 147) with:

```js
const firstNameCol = pick(row, 'First Name', 'Given Name');
const lastNameCol = pick(row, 'Last Name', 'Surname');
let firstName, middleName, lastName;
if (firstNameCol || lastNameCol) {
  firstName = firstNameCol;
  middleName = pick(row, 'Middle Name');
  lastName = lastNameCol;
} else {
  // Legacy single-column file support.
  ({ firstName, middleName, lastName } = splitName(pick(row, 'Full Name', 'Name', 'Scholar Name')));
}
const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
if (!fullName.trim()) throw new Error('Missing First Name/Last Name (or Full Name)');
```

- [ ] **Step 4: Read the new semester columns and compute `grantSchoolYear`**

Once per invocation (before the row loop), fetch the current term:

```js
const currentTerm = await getCurrentSchoolYearAndSemester(db);
if (!currentTerm) throw new AppError('No active school year/semester is configured.', 400, 'NO_ACTIVE_TERM');
```

Per row, replace the `semesters`/`grantYear`/`academicYear` block (lines 152-155) with:

```js
const totalScholarshipSemesters = parseInt(pick(row, 'Total Scholarship Semesters'), 10) || 0;
const activeScholarshipSemesters = parseInt(pick(row, 'Active Scholarship Semesters'), 10) || 0;
if (activeScholarshipSemesters < 1) throw new Error('Active Scholarship Semesters must be at least 1');
const grantSchoolYear = computeGrantSchoolYear(currentTerm.yearStart, currentTerm.semesterIndex, activeScholarshipSemesters);
const yearAwarded = Number(grantSchoolYear.split('-')[0]);
```

- [ ] **Step 5: Duplicate Scholar ID check (new)**

Before creating the Auth account, if the row supplies a Scholar ID:

```js
const suppliedScholarId = pick(row, 'Scholar ID');
if (suppliedScholarId) {
  const dupSnap = await db.collection(COLLECTIONS.USERS).where('scholarId', '==', suppliedScholarId).limit(1).get();
  if (!dupSnap.empty) throw new Error(`Scholar ID ${suppliedScholarId} already exists`);
}
```

- [ ] **Step 6: Generate the password and create the account (replaces line 148, 158-164)**

```js
const password = generateTemporaryPassword(lastName, grantSchoolYear);
...
const userRecord = await auth.createUser({ email, password, displayName: fullName, emailVerified: true });
```
(unchanged shape otherwise)

- [ ] **Step 7: Write the new Firestore fields (extends the `.set()` call at lines 167-202)**

Add to the existing doc payload:

```js
scholarId: suppliedScholarId || scholarId, // existing auto-generated `scholarId` (line 156) used only when not supplied
uid: userRecord.uid,
totalScholarshipSemesters,
grantSchoolYear,
yearAwarded, // replaces the old computeGrantYear() value — same field, new derivation
mustChangePassword: true,
activatedAt: null,
lastLogin: null,
passwordChangedAt: null,
```

(`yearLevel`/`adminStatus`/`scholarshipStatus` reads via `Year Level`/`Status` columns are unchanged from the current implementation.)

- [ ] **Step 8: Manual verification against the Functions emulator**

Run: `cd backend/functions && npm run serve` (starts `firebase emulators:start --only functions`), then POST a small test payload (2-3 rows covering: auto-generated Scholar ID, supplied Scholar ID, a supplied duplicate Scholar ID expected to fail, First/Middle/Last columns, and a legacy single-`Full Name`-column row) to `http://127.0.0.1:5001/demo-capstone/us-central1/bulkCreateScholars` with the `x-admin-key` header. Confirm the response's `results` show the expected `created`/`failed` split and that `password` in each `created` result matches `generateTemporaryPassword`'s expected output for that row.

- [ ] **Step 9: Commit**

```bash
git add backend/functions/src/http/scholarImport.js
git commit -m "feat: rewrite bulkCreateScholars with new schema, split-name columns, and duplicate scholarId check"
```

---

### Task 5: Scholar account management endpoints (regenerate password, enable/disable)

**Files:**
- Create: `backend/functions/src/http/scholarAccountManagement.js`
- Modify: `backend/functions/src/index.js` (register the two new exports)
- Modify: `admin-ui/src/services/backendApi.js` (add client wrappers)

**Interfaces:**
- Produces: `POST /regenerateScholarPassword {targetUid}` → `{success, password}`; `POST /setScholarAccountDisabled {targetUid, disabled}` → `{success}`. Both gated by the same `x-admin-key` header pattern as `bulkCreateScholars` (see Global Constraints — the existing `resetUserPassword`/`deactivateUser` require a real admin ID token the admin panel can never send).

- [ ] **Step 1: Implement the two endpoints**

```js
// backend/functions/src/http/scholarAccountManagement.js
'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { AppError, handleError } = require('../utils/errors');
const { COLLECTIONS, AUDIT_ACTIONS } = require('../constants/collections');
const { writeAuditLog } = require('../utils/audit');
const { isValidUid } = require('../utils/validation');
const { generateTemporaryPassword } = require('../utils/temporaryPassword');

const ADMIN_IMPORT_KEY = process.env.ADMIN_IMPORT_KEY || 'ced-admin-import-2026';

function requireAdminKey(req) {
  if (req.get('x-admin-key') !== ADMIN_IMPORT_KEY) {
    throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
  }
}

// POST /regenerateScholarPassword { targetUid }
// Re-derives the scholar's temp password from their CURRENT lastName +
// grantSchoolYear (already on their doc) and sets it as their real Auth
// password, forcing a change again on next login.
exports.regenerateScholarPassword = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    requireAdminKey(req);
    const { targetUid } = req.body || {};
    if (!targetUid || !isValidUid(targetUid)) throw new AppError('Invalid targetUid.', 400, 'INVALID_UID');

    const { auth, db } = getFirebaseAdmin();
    const docSnap = await db.collection(COLLECTIONS.USERS).doc(targetUid).get();
    if (!docSnap.exists) throw new AppError('Scholar not found.', 404, 'NOT_FOUND');
    const data = docSnap.data();

    const password = generateTemporaryPassword(data.lastName, data.grantSchoolYear || '2026-2027');
    await auth.updateUser(targetUid, { password });
    await docSnap.ref.update({ mustChangePassword: true });

    await writeAuditLog(db, {
      userId: 'admin-import', userRole: 'admin', action: AUDIT_ACTIONS.PASSWORD_RESET,
      collection: COLLECTIONS.USERS, documentId: targetUid, details: 'Temporary password regenerated by admin',
    });

    return res.json({ success: true, password });
  } catch (err) {
    return handleError(res, err, 'regenerateScholarPassword');
  }
});

// POST /setScholarAccountDisabled { targetUid, disabled }
// Firebase Auth's own `disabled` flag is the source of truth (Auth rejects
// sign-in for a disabled account natively); mirrored into Firestore only so
// the admin UI can filter Active/Disabled lists without a separate Auth call.
exports.setScholarAccountDisabled = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    requireAdminKey(req);
    const { targetUid, disabled } = req.body || {};
    if (!targetUid || !isValidUid(targetUid)) throw new AppError('Invalid targetUid.', 400, 'INVALID_UID');

    const { auth, db } = getFirebaseAdmin();
    const shouldDisable = disabled !== false;
    await auth.updateUser(targetUid, { disabled: shouldDisable });
    await db.collection(COLLECTIONS.USERS).doc(targetUid).update({ accountDisabled: shouldDisable });

    await writeAuditLog(db, {
      userId: 'admin-import', userRole: 'admin', action: AUDIT_ACTIONS.UPDATE,
      collection: COLLECTIONS.USERS, documentId: targetUid,
      details: `Account ${shouldDisable ? 'disabled' : 're-enabled'} by admin`,
    });

    return res.json({ success: true });
  } catch (err) {
    return handleError(res, err, 'setScholarAccountDisabled');
  }
});
```

- [ ] **Step 2: Register the exports**

In `backend/functions/src/index.js`, alongside the existing `bulkCreateScholars` export, add:
```js
const { regenerateScholarPassword, setScholarAccountDisabled } = require('./http/scholarAccountManagement');
exports.regenerateScholarPassword = regenerateScholarPassword;
exports.setScholarAccountDisabled = setScholarAccountDisabled;
```

- [ ] **Step 3: Add admin-ui client wrappers**

```js
// admin-ui/src/services/backendApi.js — near bulkCreateScholars
export async function regenerateScholarPassword({ targetUid }) {
  return requestJson('/regenerateScholarPassword', {
    method: 'POST', headers: { 'x-admin-key': ADMIN_IMPORT_KEY }, body: { targetUid },
  });
}

export async function setScholarAccountDisabled({ targetUid, disabled }) {
  return requestJson('/setScholarAccountDisabled', {
    method: 'POST', headers: { 'x-admin-key': ADMIN_IMPORT_KEY }, body: { targetUid, disabled },
  });
}
```

- [ ] **Step 4: Manual verification against the Functions emulator**

With the emulator running (Task 4 Step 8), POST to both new endpoints for a scholar doc created in that same test batch; confirm `regenerateScholarPassword` returns a new password matching `generateTemporaryPassword`'s output and `mustChangePassword` flips back to `true` in Firestore; confirm `setScholarAccountDisabled` flips both the Auth `disabled` flag (check via `firebase auth:export` or the emulator UI at `localhost:4000`) and the Firestore `accountDisabled` field.

- [ ] **Step 5: Commit**

```bash
git add backend/functions/src/http/scholarAccountManagement.js backend/functions/src/index.js admin-ui/src/services/backendApi.js
git commit -m "feat: add scholar password-regeneration and account-disable endpoints"
```

---

## Phase 2 — Admin UI

### Task 6: Import validation pure function

**Files:**
- Create: `admin-ui/src/utils/scholarImportValidation.js`
- Test: `admin-ui/src/utils/scholarImportValidation.test.js`
- Modify: `admin-ui/package.json` (add `"test": "node --test src/utils"` script)

**Interfaces:**
- Produces: `validateImportRows(rows, {existingEmails: Set<string>, existingScholarIds: Set<string>}): Array<{index, row, errors: string[], warnings: string[], valid: boolean}>`. Used by Task 7.

- [ ] **Step 1: Write the failing test**

```js
// admin-ui/src/utils/scholarImportValidation.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImportRows } from './scholarImportValidation.js';

const baseRow = {
  'Scholar ID': '', 'First Name': 'Juan', 'Middle Name': '', 'Last Name': 'Dela Cruz',
  Email: 'juan@example.com', School: 'Mindoro State University', Program: 'BSIT',
  'Year Level': '2', Status: 'Active', 'Total Scholarship Semesters': '8', 'Active Scholarship Semesters': '2',
};

test('a fully valid row has no errors', () => {
  const [result] = validateImportRows([baseRow], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test('flags missing First Name, Last Name, invalid email, missing School/Program/Year Level', () => {
  const badRow = { ...baseRow, 'First Name': '', 'Last Name': '', Email: 'not-an-email', School: '', Program: '', 'Year Level': '' };
  const [result] = validateImportRows([badRow], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(result.errors.includes('Missing First Name'));
  assert.ok(result.errors.includes('Missing Last Name'));
  assert.ok(result.errors.includes('Invalid email format'));
  assert.ok(result.errors.includes('Missing School'));
  assert.ok(result.errors.includes('Missing Program'));
  assert.ok(result.errors.includes('Missing Year Level'));
});

test('flags Active Scholarship Semesters < 1', () => {
  const badRow = { ...baseRow, 'Active Scholarship Semesters': '0' };
  const [result] = validateImportRows([badRow], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(result.errors.includes('Active Scholarship Semesters must be at least 1'));
});

test('flags Total < Active semesters', () => {
  const badRow = { ...baseRow, 'Total Scholarship Semesters': '1', 'Active Scholarship Semesters': '2' };
  const [result] = validateImportRows([badRow], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(result.errors.includes('Total Scholarship Semesters must be >= Active Scholarship Semesters'));
});

test('flags an email that already has an account', () => {
  const [result] = validateImportRows([baseRow], { existingEmails: new Set(['juan@example.com']), existingScholarIds: new Set() });
  assert.ok(result.errors.includes('Email already has an account'));
});

test('flags a Scholar ID that already exists', () => {
  const row = { ...baseRow, 'Scholar ID': '2026-00001' };
  const [result] = validateImportRows([row], { existingEmails: new Set(), existingScholarIds: new Set(['2026-00001']) });
  assert.ok(result.errors.includes('Scholar ID already exists'));
});

test('flags duplicate emails and duplicate Scholar IDs WITHIN the file', () => {
  const row2 = { ...baseRow, 'First Name': 'Maria', 'Last Name': 'Santos' };
  const [, second] = validateImportRows([baseRow, row2], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(second.errors.includes('Duplicate email within this file'));
});

test('warns (does not block) on same name+school appearing twice', () => {
  const [, second] = validateImportRows([baseRow, { ...baseRow, Email: 'other@example.com' }], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(second.warnings.includes('Possible duplicate: same name + school already in this file'));
  assert.equal(second.valid, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test admin-ui/src/utils/scholarImportValidation.test.js`
Expected: FAIL with "Cannot find module './scholarImportValidation.js'"

- [ ] **Step 3: Write minimal implementation**

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

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test admin-ui/src/utils/scholarImportValidation.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add admin-ui/src/utils/scholarImportValidation.js admin-ui/src/utils/scholarImportValidation.test.js admin-ui/package.json
git commit -m "feat: add pure scholar-import validation function"
```

---

### Task 7: Excel template columns + import preview UI

**Files:**
- Modify: `admin-ui/src/pages/Scholars.jsx` (`handleDownloadTemplate` ~line 474-494, `handleFileChange` ~line 517-593)

**Interfaces:**
- Consumes: `validateImportRows` (Task 6)

- [ ] **Step 1: Update the template columns**

In `handleDownloadTemplate`, change the one example row from the current `{Full Name, Email, School, Program, Year Level, Number of Semesters, Status}` shape to:

```js
const ws = XLSX.utils.json_to_sheet([{
  'Scholar ID': '',
  'First Name': 'Juan',
  'Middle Name': '',
  'Last Name': 'Dela Cruz',
  Email: 'juan.delacruz@example.com',
  School: 'Divine Word College',
  Program: 'Bachelor of Science in Information Technology',
  'Year Level': '2',
  Status: 'Active',
  'Total Scholarship Semesters': '8',
  'Active Scholarship Semesters': '2',
}]);
```

- [ ] **Step 2: Build the existing-emails/scholarIds sets from `applicants`**

Near the top of `handleFileChange`, after parsing `rows` (line 526):

```js
const existingEmails = new Set(applicants.map(a => (a.email || '').trim().toLowerCase()).filter(Boolean));
const existingScholarIds = new Set(applicants.map(a => a.scholarId).filter(Boolean));
const validated = validateImportRows(rows, { existingEmails, existingScholarIds });
```

- [ ] **Step 3: Replace the immediate confirm dialog with a preview step**

Replace the `Swal.fire({title: 'Create scholar accounts?', ...})` confirm block (lines 533-543) with a SweetAlert2 HTML-table preview (matching the existing SweetAlert2 usage convention already in this file) listing every row's status (OK / error text / warning text), and only proceed to the existing chunked-import loop for rows where `valid === true`:

```js
const errorRows = validated.filter(r => !r.valid);
const okRows = validated.filter(r => r.valid);
const previewHtml = `
  <div style="max-height:300px;overflow:auto;text-align:left;font-size:0.85em">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr><th>Row</th><th>Name</th><th>Status</th></tr></thead>
      <tbody>
        ${validated.map(r => `
          <tr style="color:${r.valid ? (r.warnings.length ? '#b8860b' : '#2e7d32') : '#c62828'}">
            <td>${r.index + 1}</td>
            <td>${r.row['First Name'] || ''} ${r.row['Last Name'] || ''}</td>
            <td>${r.errors.concat(r.warnings).join('; ') || 'OK'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`;

const confirm = await Swal.fire({
  title: 'Review import',
  html: `${okRows.length} of ${validated.length} row(s) will be imported (${errorRows.length} have errors and will be skipped).${previewHtml}`,
  icon: errorRows.length ? 'warning' : 'question',
  showCancelButton: true,
  confirmButtonText: `Create ${okRows.length} account(s)`,
  confirmButtonColor: 'var(--primary)',
});
if (!confirm.isConfirmed || okRows.length === 0) return;
```

Then feed `okRows.map(r => r.row)` (not the raw `rows`) into the existing chunking loop (line 556 onward) — everything after that point (chunked `bulkCreateScholars` calls, progress `Swal.update`, results summary, `downloadCredentials`) stays unchanged.

- [ ] **Step 4: Manual verification**

Run `npm run dev` in `admin-ui`, go to Scholars → Import Scholars, upload a test file with a mix of valid rows, a row missing Last Name, a row with an invalid email, and two rows sharing an email — confirm the preview table shows the right color/reason per row and that only valid rows proceed to account creation.

- [ ] **Step 5: Commit**

```bash
git add admin-ui/src/pages/Scholars.jsx
git commit -m "feat: add import preview with validation before creating scholar accounts"
```

---

### Task 8: Active/Disabled accounts view + Reset/Regenerate Password UI

**Files:**
- Modify: `admin-ui/src/pages/Scholars.jsx`

**Interfaces:**
- Consumes: `regenerateScholarPassword`, `setScholarAccountDisabled` (Task 5)

- [ ] **Step 1: Add an Account Status filter/column**

Add an "Active Accounts" / "Disabled Accounts" filter option to the existing Scholars list filter bar (same pattern as the existing `All Status`/HEI/Academic Year filters already in this page), reading each scholar's `accountDisabled` field (defaults to `false`/active when absent, since it's a new field legacy docs won't have until Task 9's migration runs).

- [ ] **Step 2: Add per-row actions**

In the scholar list's Actions column, add two buttons alongside the existing `View` button:
- **Reset/Regenerate Password**: confirm dialog → calls `regenerateScholarPassword({targetUid: scholar.uid})` → shows the returned temp password in a follow-up dialog (same "show credentials" pattern as `downloadCredentials`).
- **Disable/Enable Account**: confirm dialog → calls `setScholarAccountDisabled({targetUid: scholar.uid, disabled: !scholar.accountDisabled})` → toggles the button label based on current state.

Both buttons are disabled (grayed out, with a tooltip) for any scholar whose doc has no `uid` field yet (i.e., not yet migrated by Task 9) — regenerating a password or disabling an Auth account that doesn't exist yet would fail.

- [ ] **Step 3: Manual verification**

With the Functions emulator running and a couple of test scholars imported (Task 4), verify: filtering by Active/Disabled works, Reset Password shows a new temp password and the scholar's `mustChangePassword` flips true, Disable Account flips the button to "Enable" and (checked via the emulator's Auth UI at `localhost:4000`) the Auth account's `disabled` flag is `true`.

- [ ] **Step 4: Commit**

```bash
git add admin-ui/src/pages/Scholars.jsx
git commit -m "feat: add active/disabled account filter and reset/regenerate password actions"
```

---

## Phase 3 — Legacy account migration (must complete before Phase 4 ships)

### Task 9: Backfill migration script

**Files:**
- Create: `backend/functions/scripts/migrateLegacyPasswordsToAuth.js` (follows the existing `seedEmulator.js`/`smokeCheck.js` script conventions in this same directory)

**Interfaces:** none (standalone script, run via `node`, not imported elsewhere)

- [ ] **Step 1: Write the script**

```js
// backend/functions/scripts/migrateLegacyPasswordsToAuth.js
'use strict';

// One-time backfill: every `users` doc with a plaintext `password` field and
// no `uid` gets a real Firebase Auth account created using that EXISTING
// password (so nobody is forced to change a password they already know —
// they already "activated" long ago), records the returned uid on the doc
// (doc id is left unchanged — renaming it would break enrolledSemesters,
// chat threads, and anything else keyed off the old id), sets
// mustChangePassword: false, and clears the plaintext password field.
//
// Usage:
//   node scripts/migrateLegacyPasswordsToAuth.js --dry-run   (report only, no writes)
//   node scripts/migrateLegacyPasswordsToAuth.js             (perform the migration)
//   node scripts/migrateLegacyPasswordsToAuth.js --verify    (report count of docs still missing uid)

const { getFirebaseAdmin } = require('../src/config/firebase');
const { COLLECTIONS } = require('../src/constants/collections');

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const verifyOnly = process.argv.includes('--verify');
  const { auth, db, fieldValue } = getFirebaseAdmin();

  const snap = await db.collection(COLLECTIONS.USERS).get();
  const needsMigration = snap.docs.filter((d) => {
    const data = d.data();
    return !data.uid && typeof data.password === 'string' && data.password.length > 0;
  });

  if (verifyOnly) {
    const stillMissing = snap.docs.filter((d) => !d.data().uid);
    console.log(`Docs missing uid: ${stillMissing.length}`);
    if (stillMissing.length > 0) {
      console.log('First 20 doc ids still missing uid:', stillMissing.slice(0, 20).map((d) => d.id));
    }
    process.exitCode = stillMissing.length === 0 ? 0 : 1;
    return;
  }

  console.log(`Found ${needsMigration.length} doc(s) needing migration.${dryRun ? ' (dry run — no writes)' : ''}`);

  let migrated = 0;
  let failed = 0;
  for (const doc of needsMigration) {
    const data = doc.data();
    if (!data.email) { console.warn(`Skipping ${doc.id}: no email`); failed++; continue; }
    try {
      if (dryRun) { migrated++; continue; }

      let userRecord;
      try {
        userRecord = await auth.createUser({
          email: data.email, password: data.password, emailVerified: true,
          displayName: [data.firstName, data.lastName].filter(Boolean).join(' ') || data.email,
        });
      } catch (e) {
        if (e.code === 'auth/email-already-exists') {
          userRecord = await auth.getUserByEmail(data.email);
        } else {
          throw e;
        }
      }

      await doc.ref.update({
        uid: userRecord.uid,
        mustChangePassword: false,
        password: fieldValue.delete(),
      });
      migrated++;
    } catch (e) {
      console.error(`Failed to migrate ${doc.id} (${data.email}):`, e.message);
      failed++;
    }
  }

  console.log(`Done. Migrated: ${migrated}, Failed: ${failed}.`);
  if (failed > 0) {
    console.log('Re-run with --verify after resolving failures manually.');
    process.exitCode = 1;
  }
}

run().then(() => process.exit(process.exitCode || 0)).catch((e) => {
  console.error('Migration script crashed:', e);
  process.exit(1);
});
```

- [ ] **Step 2: Dry-run against the Functions emulator**

Run: `cd backend/functions && npm run seed:emulator` (populates test data per the existing `seedEmulator.js` convention) then `node scripts/migrateLegacyPasswordsToAuth.js --dry-run` against the emulator (set `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST` per the existing `emulators:seed` script's env pattern). Confirm the reported count matches the number of emulator-seeded legacy docs with a `password` field.

- [ ] **Step 3: Real dry-run against production, then a manual go/no-go checkpoint**

Run `node scripts/migrateLegacyPasswordsToAuth.js --dry-run` against **production** credentials (`GOOGLE_APPLICATION_CREDENTIALS` pointed at the real service account) and report the exact count of docs that would be migrated.

**This is a hard stop — do not run the real (non-dry-run) migration without explicit confirmation from the project owner first.** This creates real Firebase Auth accounts and mutates every existing scholar/applicant's Firestore document in production; it is exactly the kind of hard-to-reverse, shared-system action that requires a check-in before proceeding, regardless of how the rest of this plan is being executed (subagent-driven or otherwise).

- [ ] **Step 4: Run the real migration (after explicit go-ahead) and verify**

```bash
node scripts/migrateLegacyPasswordsToAuth.js
node scripts/migrateLegacyPasswordsToAuth.js --verify
```

The `--verify` run's reported "Docs missing uid" count **must be 0** before Task 14 (security rules) is deployed. If it's nonzero, resolve the listed doc ids individually (most likely cause: two different Firestore docs sharing one email, or a missing email field) and re-run `--verify` until it's clean.

- [ ] **Step 5: Commit**

```bash
git add backend/functions/scripts/migrateLegacyPasswordsToAuth.js
git commit -m "feat: add legacy scholar/applicant Firebase Auth backfill script"
```

---

## Phase 4 — Flutter (ships only after Task 9's verification is clean)

### Task 10: `StudentModel` schema additions

**Files:**
- Modify: `scholar-ui11/lib/core/models/student_model.dart`
- Test: `scholar-ui11/test/core/models/student_model_test.dart` (extend existing file)

**Interfaces:**
- Produces: new nullable fields `uid`, `mustChangePassword`, `activatedAt`, `lastLogin`, `passwordChangedAt`, `totalScholarshipSemesters`, `grantSchoolYear` on `StudentModel`. `password` becomes optional (default `''`) rather than required — kept only so any not-yet-migrated legacy doc still deserializes without crashing; new code never writes it.

- [ ] **Step 1: Read the existing test file to match its style**

Read `scholar-ui11/test/core/models/student_model_test.dart` in full before extending it.

- [ ] **Step 2: Write the failing test**

Add to the existing test file:

```dart
test('fromJson defaults new activation fields when absent (legacy doc)', () {
  final json = {
    'firstName': 'Ana', 'lastName': 'Cruz', 'email': 'a@example.com',
    'street': 'Rizal St', 'barangay': 'Poblacion', 'city': 'Calapan',
    'province': 'Oriental Mindoro', 'gender': 'Female',
  };
  final model = StudentModel.fromJson(json);
  expect(model.uid, isNull);
  expect(model.mustChangePassword, isFalse);
  expect(model.password, isEmpty);
});

test('fromJson reads the new activation fields when present', () {
  final json = {
    'firstName': 'Ana', 'lastName': 'Cruz', 'email': 'a@example.com',
    'street': 'Rizal St', 'barangay': 'Poblacion', 'city': 'Calapan',
    'province': 'Oriental Mindoro', 'gender': 'Female',
    'uid': 'abc123', 'mustChangePassword': true,
    'totalScholarshipSemesters': 8, 'grantSchoolYear': '2024-2025',
  };
  final model = StudentModel.fromJson(json);
  expect(model.uid, 'abc123');
  expect(model.mustChangePassword, isTrue);
  expect(model.totalScholarshipSemesters, 8);
  expect(model.grantSchoolYear, '2024-2025');
});

test('StudentModel can be constructed without a password (new Firebase-Auth flow)', () {
  final model = StudentModel(
    firstName: 'Ana', middleName: '', lastName: 'Cruz',
    street: 'Rizal St', barangay: 'Poblacion', city: 'Calapan',
    province: 'Oriental Mindoro', gender: 'Female', dateOfBirth: DateTime(2002, 5, 10),
    contactNumber: '09171234567', email: 'a@example.com',
    schoolName: 'MinSU', yearLevel: '2', academicProgram: 'BSIT',
    academicYear: '2025-2026', semester: '1st Semester',
  );
  expect(model.password, isEmpty);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `flutter test test/core/models/student_model_test.dart`
Expected: FAIL — `password` is a required parameter, so the third new test fails to compile; the first two fail because the fields don't exist yet.

- [ ] **Step 4: Implement the model changes**

In `student_model.dart`:
- Change `final String password;` field to keep the type but make the constructor parameter `this.password = ''` (remove `required`).
- Add fields: `final String? uid; final bool mustChangePassword; final DateTime? activatedAt; final DateTime? lastLogin; final DateTime? passwordChangedAt; final int? totalScholarshipSemesters; final String? grantSchoolYear;`
- Add matching constructor params: `this.uid, this.mustChangePassword = false, this.activatedAt, this.lastLogin, this.passwordChangedAt, this.totalScholarshipSemesters, this.grantSchoolYear,`
- Add to `copyWith(...)` following the exact same pattern as every other nullable field there.
- Add to `toJson()`: `'uid': uid, 'mustChangePassword': mustChangePassword, 'activatedAt': activatedAt?.toIso8601String(), 'lastLogin': lastLogin?.toIso8601String(), 'passwordChangedAt': passwordChangedAt?.toIso8601String(), 'totalScholarshipSemesters': totalScholarshipSemesters, 'grantSchoolYear': grantSchoolYear,`
- Add to `fromJson(...)`: `uid: json['uid']?.toString(), mustChangePassword: json['mustChangePassword'] == true, activatedAt: json['activatedAt'] == null ? null : parseDate(json['activatedAt']), lastLogin: json['lastLogin'] == null ? null : parseDate(json['lastLogin']), passwordChangedAt: json['passwordChangedAt'] == null ? null : parseDate(json['passwordChangedAt']), totalScholarshipSemesters: (json['totalScholarshipSemesters'] as num?)?.toInt(), grantSchoolYear: json['grantSchoolYear']?.toString(),` (and `password: json['password']?.toString() ?? ''`, unchanged except no longer required).

- [ ] **Step 5: Run test to verify it passes**

Run: `flutter test test/core/models/student_model_test.dart`
Expected: PASS (all tests, including the two pre-existing ones — confirm `auth_provider_test.dart`'s `_buildScholar()` helper, which passes an explicit `password:`, still compiles and passes too: `flutter test test/features/auth/providers/auth_provider_test.dart`)

- [ ] **Step 6: Commit**

```bash
git add scholar-ui11/lib/core/models/student_model.dart scholar-ui11/test/core/models/student_model_test.dart
git commit -m "feat: add account-activation fields to StudentModel, make password optional"
```

---

### Task 11: Real Firebase Auth login

**Files:**
- Modify: `scholar-ui11/lib/features/auth/providers/auth_provider.dart` (`login()` method and its helpers)

**Interfaces:**
- Consumes: `StudentModel` (Task 10)
- Produces: same `AuthState`/`login()` public contract other screens already call — no signature change, only internal behavior.

- [ ] **Step 1: Read the current `login()` implementation and its helpers in full**

Read `auth_provider.dart` completely (the file is ~500+ lines per the earlier research) before editing — in particular the current `login()` method, `_findStudentByEmailFromFirestore`, and how `_listenToStudentDoc`/`_isRemovedData` are wired, since those stay unchanged.

- [ ] **Step 2: Replace the sign-in mechanism**

Replace the anonymous-auth + Firestore-email-query + plaintext-compare body of `login()` with:

```dart
await FirebaseAuth.instance.signInWithEmailAndPassword(email: email, password: password);
final uid = FirebaseAuth.instance.currentUser!.uid;
final doc = await _studentsCollection?.doc(uid).get();
if (doc == null || !doc.exists) {
  await FirebaseAuth.instance.signOut();
  state = state.copyWith(isLoading: false, error: 'Account not found.');
  return;
}
final student = _normalizeStudentStatus(StudentModel.fromJson(doc.data()!));
if (_isRemovedData(doc.data())) {
  await FirebaseAuth.instance.signOut();
  state = state.copyWith(isLoading: false, error: 'This account is no longer active.');
  return;
}
_registeredStudents[student.id] = student;
await _saveStudentsToStorage();
await _saveLoggedInUser(student.id);
_listenToStudentDoc(student.id);
state = state.copyWith(isLoggedIn: true, isLoading: false, student: student, error: null);
```

Map `FirebaseAuthException` codes to the same user-facing error strings the app already shows elsewhere (`wrong-password`/`invalid-credential` → "Incorrect email or password.", `user-not-found` → "No account found with that email.", `user-disabled` → "This account has been disabled.", `too-many-requests` → "Too many attempts. Try again later.").

- [ ] **Step 3: Manual verification**

Using the Functions/Auth emulator with a scholar created via Task 4's manual test, run the app against the emulator (`flutter run --dart-define=USE_EMULATORS=true` or the project's existing emulator-mode flag) and confirm: login with the generated temp password succeeds, a wrong password shows "Incorrect email or password," and `notifier.loginWithStudent(...)` (used by `auth_provider_test.dart`) and `markCelebrationSeen()` still work — run `flutter test test/features/auth/providers/auth_provider_test.dart` to confirm those two pre-existing tests still pass unchanged.

- [ ] **Step 4: Commit**

```bash
git add scholar-ui11/lib/features/auth/providers/auth_provider.dart
git commit -m "feat: migrate scholar login to real Firebase Auth sign-in"
```

---

### Task 12: Forced password-change screen + router guard

**Files:**
- Create: `scholar-ui11/lib/features/auth/screens/change_password_screen.dart`
- Modify: `scholar-ui11/lib/core/router/app_router.dart`
- Test: `scholar-ui11/test/core/router/app_router_test.dart` (new, mirrors the existing pure-function-test pattern used for `celebrationRedirectTarget`)

**Interfaces:**
- Produces: `mustChangePasswordRedirectTarget({required bool mustChangePassword, required bool onChangePasswordScreen}): String?` — pure, unit-tested, mirrors the existing `celebrationRedirectTarget` pattern exactly.

- [ ] **Step 1: Write the failing test for the pure redirect function**

```dart
// scholar-ui11/test/core/router/app_router_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/router/app_router.dart';

void main() {
  test('redirects to change-password when required and not already there', () {
    expect(
      mustChangePasswordRedirectTarget(mustChangePassword: true, onChangePasswordScreen: false),
      '/change-password',
    );
  });

  test('does not redirect when already on the change-password screen', () {
    expect(
      mustChangePasswordRedirectTarget(mustChangePassword: true, onChangePasswordScreen: true),
      isNull,
    );
  });

  test('does not redirect when a password change is not required', () {
    expect(
      mustChangePasswordRedirectTarget(mustChangePassword: false, onChangePasswordScreen: false),
      isNull,
    );
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/core/router/app_router_test.dart`
Expected: FAIL — `mustChangePasswordRedirectTarget` doesn't exist yet.

- [ ] **Step 3: Add the pure function and wire it into the router**

In `app_router.dart`, alongside `celebrationRedirectTarget`:

```dart
String? mustChangePasswordRedirectTarget({
  required bool mustChangePassword,
  required bool onChangePasswordScreen,
}) {
  if (mustChangePassword && !onChangePasswordScreen) return '/change-password';
  return null;
}
```

In the `redirect:` callback, after the existing `isLoggedIn` check (before the celebration-redirect logic, so a forced password change takes priority over the celebration screen):

```dart
final student = ref.read(currentStudentProvider);
final mustChangeRedirect = mustChangePasswordRedirectTarget(
  mustChangePassword: student?.mustChangePassword ?? false,
  onChangePasswordScreen: state.matchedLocation == '/change-password',
);
if (mustChangeRedirect != null) return mustChangeRedirect;
```

Add the route:
```dart
GoRoute(
  path: '/change-password',
  name: 'change-password',
  builder: (context, state) => const ChangePasswordScreen(),
),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/core/router/app_router_test.dart`
Expected: PASS (3 tests)

- [ ] **Step 5: Build the `ChangePasswordScreen`**

```dart
// scholar-ui11/lib/features/auth/screens/change_password_screen.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});
  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_newController.text != _confirmController.text) {
      setState(() => _error = 'New password and confirmation do not match.');
      return;
    }
    setState(() { _isSubmitting = true; _error = null; });
    try {
      final user = FirebaseAuth.instance.currentUser!;
      final cred = EmailAuthProvider.credential(email: user.email!, password: _currentController.text);
      await user.reauthenticateWithCredential(cred);
      await user.updatePassword(_newController.text);
      await FirebaseFirestore.instance.collection('users').doc(user.uid).update({
        'mustChangePassword': false,
        'activatedAt': FieldValue.serverTimestamp(),
        'passwordChangedAt': FieldValue.serverTimestamp(),
      });
      ref.invalidate(authStateProvider);
    } on FirebaseAuthException catch (e) {
      setState(() => _error = e.code == 'invalid-credential' || e.code == 'wrong-password'
          ? 'Current password is incorrect.'
          : 'Could not update password: ${e.message}');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Change Your Password'), automaticallyImplyLeading: false),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              const Text('You must set a new password before continuing.'),
              const SizedBox(height: 16),
              TextFormField(
                controller: _currentController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Current (temporary) password'),
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              TextFormField(
                controller: _newController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'New password'),
                validator: (v) => (v == null || v.length < 8) ? 'At least 8 characters' : null,
              ),
              TextFormField(
                controller: _confirmController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Confirm new password'),
                validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              ),
              if (_error != null) Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                child: _isSubmitting ? const CircularProgressIndicator() : const Text('Update Password'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 6: Manual verification**

Against the emulator, log in with a scholar whose `mustChangePassword` is `true` (from Task 4's test batch); confirm the app redirects straight to `/change-password` and no other route is reachable (try manually navigating — the `redirect:` guard should bounce back); submit a wrong current password (inline error shown, stays on screen); submit matching new/confirm passwords and confirm it navigates onward and `mustChangePassword` is now `false` in Firestore.

- [ ] **Step 7: Commit**

```bash
git add scholar-ui11/lib/features/auth/screens/change_password_screen.dart scholar-ui11/lib/core/router/app_router.dart scholar-ui11/test/core/router/app_router_test.dart
git commit -m "feat: force password change on first login via a new router guard"
```

---

### Task 13: Self-registration migrates to real Firebase Auth

**Files:**
- Modify: `scholar-ui11/lib/features/auth/screens/registration_screen.dart`
- Modify: `scholar-ui11/lib/features/auth/providers/auth_provider.dart` (`register()`)

**Interfaces:** none new — internal behavior change only.

- [ ] **Step 1: Read the current registration flow in full**

Read `registration_screen.dart` and `auth_provider.dart`'s `register()` method completely before editing.

- [ ] **Step 2: Update `register()` to create a real Auth account**

Replace the direct Firestore-doc-with-plaintext-password write with:

```dart
final credential = await FirebaseAuth.instance.createUserWithEmailAndPassword(email: email, password: password);
final uid = credential.user!.uid;
final student = StudentModel(
  id: uid, // doc id == uid for every account created from now on
  uid: uid,
  mustChangePassword: false, // the applicant chose this password themselves
  // ...rest of the fields as today, minus `password`
);
await _studentsCollection?.doc(uid).set(student.toJson());
```

Map `FirebaseAuthException` codes (`email-already-in-use`, `weak-password`) to the existing user-facing error display already used by this screen.

- [ ] **Step 3: Manual verification**

Against the emulator, register a brand-new applicant account through the UI; confirm a Firebase Auth account is created (visible in the emulator Auth UI), the Firestore doc id matches the Auth uid, `mustChangePassword` is `false`, and logging out and back in with the chosen password succeeds via Task 11's new login path.

- [ ] **Step 4: Commit**

```bash
git add scholar-ui11/lib/features/auth/screens/registration_screen.dart scholar-ui11/lib/features/auth/providers/auth_provider.dart
git commit -m "feat: migrate self-registration to real Firebase Auth account creation"
```

---

## Phase 5 — Security (manual deploy, gated on Task 9 + Phase 4 being live)

### Task 14: Firestore security rules tightening

**Files:**
- Modify: `firestore.rules`

**Interfaces:** none (declarative rules file)

- [ ] **Step 1: Update the `/users/{userId}` rule**

**Correction (2026-07-29):** the original design below gated admin access on
`isAdminOrStaff()` (`request.auth.token.role`). That would have broken the
admin panel outright — it signs in to Firebase **anonymously** (unchanged by
this whole plan; migrating admin auth is out of scope) and has no custom
claims at all, so `isAdminOrStaff()` is always `false` for it. Use the
anonymous-vs-real distinction instead (`request.auth.token.firebase.sign_in_provider`),
which preserves 100% of today's admin-panel behavior while adding a real
restriction for scholar/applicant sessions (which now use real email/password
sign-in, thanks to this plan).

Replace the current `allow read, write: if signedIn();` block with:

```
function isAnonymous() {
  return signedIn() && request.auth.token.firebase.sign_in_provider == 'anonymous';
}

match /users/{userId} {
  allow read: if isAnonymous() || resource.data.uid == request.auth.uid;
  allow create: if isAnonymous() || request.resource.data.uid == request.auth.uid;
  allow update: if isAnonymous()
             || (resource.data.uid == request.auth.uid
                 && request.resource.data.diff(resource.data).affectedKeys()
                      .hasOnly(['mustChangePassword','passwordChangedAt','activatedAt','lastLogin',
                                'houseNo','street','barangay','city','province','gender','contactNumber',
                                'profilePicture','celebrationSeen']));
  allow delete: if isAnonymous();
}
```

- [ ] **Step 2: Manual verification against the Firestore emulator**

Using the emulator (`firebase emulators:start --only firestore,auth`) and the Firebase emulator's rules test harness (`@firebase/rules-unit-testing`, already implied by the emulator setup) or manual REST calls with emulator ID tokens, verify: an anonymous session (today's admin panel) can still read/write ANY doc exactly as before (no regression), a real scholar/applicant session can read/update only their own doc's allowlisted fields, and that same real session CANNOT read/update another user's doc or its own `scholarId`/`amountGranted`/`status`.

- [ ] **Step 3: Hard gate before deploying**

**Do not run `firebase deploy --only firestore:rules` until:**
1. Task 9's `--verify` run shows 0 docs missing `uid` in production, AND
2. Phase 4 (Tasks 10-13) is live in the production app (so real logins are already using `uid`-based lookups, not the old email-query path this rule change would break).

Confirm both conditions explicitly with the project owner before deploying — this is a shared-production-system change with no fast rollback once scholars start relying on the new access model.

**Corrections discovered during implementation (2026-07-29):** the task-14
implementer's self-review, cross-checking the update allowlist and the
self-only read restriction against the actual shipped `scholar-ui11` code,
found two real gaps that were fixed in a follow-up commit before this task
was considered done — see design spec §9's "Second correction" for full
detail. Summary: (1) the update allowlist was missing `grades`,
`cogSubmissions`, `corSubmissions`, `requirements` — fields the live app
already writes to a scholar's own doc — now added; (2) `allow read` was
relaxed from self-only back to `signedIn()` (matching today's behavior),
since Firestore denies an entire `whereIn` query if any possible result
would be read-denied, and the group-chat member-lookup feature
(`fetchUsersByIds`) depends on reading other members' docs. The rules
committed to this repo (see `firestore.rules`) already reflect both fixes.

- [ ] **Step 4: Deploy (after explicit go-ahead) and commit**

```bash
firebase deploy --only firestore:rules
git add firestore.rules
git commit -m "feat: tighten Firestore rules to real per-uid ownership now that Auth uid is meaningful"
```
