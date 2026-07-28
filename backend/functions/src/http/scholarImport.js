'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { AppError, handleError } = require('../utils/errors');
const { COLLECTIONS, ROLES, AUDIT_ACTIONS } = require('../constants/collections');
const { writeAuditLog } = require('../utils/audit');
const { isValidEmail } = require('../utils/validation');
const { computeGrantSchoolYear } = require('../utils/scholarshipYear');
const { generateTemporaryPassword } = require('../utils/temporaryPassword');
const { getCurrentSchoolYearAndSemester } = require('../utils/currentTerm');

// The admin panel signs in to Firebase ANONYMOUSLY (its admin/staff login is an
// app-level session, not a Firebase identity with an admin claim), so this
// endpoint can't be gated by an admin ID token like the other management
// functions. Instead it requires a shared secret in the `x-admin-key` header.
// Override in production via the ADMIN_IMPORT_KEY function env var.
const ADMIN_IMPORT_KEY = process.env.ADMIN_IMPORT_KEY || 'ced-admin-import-2026';

// Case-insensitive lookup so minor header variations still map.
function pick(row, ...keys) {
  for (const k of keys) {
    const hit = Object.keys(row).find(
      (rk) => String(rk).trim().toLowerCase() === k.toLowerCase()
    );
    if (hit && row[hit] != null && String(row[hit]).trim() !== '') {
      return String(row[hit]).trim();
    }
  }
  return '';
}

// Surname connector words that belong WITH the surname, not the middle name,
// so compound Filipino/Spanish/Dutch surnames stay intact (Dela Cruz, De Los
// Santos, Van der Berg, …).
const SURNAME_PARTICLES = new Set([
  'de', 'dela', 'del', 'dels', 'delos', 'delas', 'san', 'sta', 'sto',
  'santa', 'santo', 'los', 'las', 'da', 'di', 'la', 'le', 'van', 'von',
  'der', 'den', 'mac', 'mc', 'bin', 'al',
]);

// Splits a single "Full Name" cell into first / middle / last. Supports the
// unambiguous "Last, First M." form, and otherwise treats the trailing token(s)
// as the surname, extending backwards over known connector particles.
function splitName(full) {
  const s = String(full).trim();
  if (s.includes(',')) {
    const [last, rest = ''] = s.split(',');
    const parts = rest.trim().split(/\s+/).filter(Boolean);
    return { firstName: parts[0] || '', middleName: parts.slice(1).join(' '), lastName: last.trim() };
  }
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', middleName: '', lastName: '' };
  let i = parts.length - 1; // start of the surname
  while (i - 1 >= 1 && SURNAME_PARTICLES.has(parts[i - 1].toLowerCase())) i--;
  return {
    firstName: parts[0],
    middleName: parts.slice(1, i).join(' '),
    lastName: parts.slice(i).join(' '),
  };
}

// Finds the next free `YYYY-NNNNN` scholar-id sequence for the current year by
// reading the highest existing one (single indexed range query, no full scan).
async function nextScholarIdSeq(db, yearPrefix) {
  try {
    const snap = await db
      .collection(COLLECTIONS.USERS)
      .where('scholarId', '>=', `${yearPrefix}-`)
      .where('scholarId', '<=', `${yearPrefix}-`)
      .orderBy('scholarId', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return 1;
    const top = snap.docs[0].data().scholarId || '';
    const n = parseInt(String(top).split('-')[1], 10);
    return Number.isFinite(n) ? n + 1 : 1;
  } catch (_) {
    return 1;
  }
}

// POST /bulkCreateScholars
// Body: { rows: [{ "Scholar ID" (optional), "First Name", "Middle Name"
//                  (optional), "Last Name", "Email", "School", "Program",
//                  "Year Level", "Status", "Total Scholarship Semesters",
//                  "Active Scholarship Semesters" }, ...] }
// A legacy single "Full Name" column (instead of First/Last Name) is still
// accepted as a fallback (see splitName() below).
// Creates a Firebase Auth account + active scholar `users` doc for each row.
// The client sends rows in modest chunks so a large migration never hits the
// function timeout, and accumulates the per-row results (incl. temp passwords).
exports.bulkCreateScholars = onRequest(
  { cors: true, timeoutSeconds: 300, memory: '512MiB' },
  async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      if (req.get('x-admin-key') !== ADMIN_IMPORT_KEY) {
        throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
      }

      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      if (rows.length === 0) throw new AppError('No rows provided.', 400, 'NO_ROWS');

      const { auth, db } = getFirebaseAdmin();
      const yearPrefix = new Date().getFullYear();
      let seq = await nextScholarIdSeq(db, yearPrefix);

      // Every row's grant-year computation steps backward from THIS one
      // current term, fetched once per invocation (not per row).
      const currentTerm = await getCurrentSchoolYearAndSemester(db);
      if (!currentTerm) throw new AppError('No active school year/semester is configured.', 400, 'NO_ACTIVE_TERM');

      let created = 0;
      let skipped = 0;
      let failed = 0;
      const results = [];

      for (const row of rows) {
        const email = pick(row, 'Email', 'Email Address').toLowerCase();
        let fullName = '';
        try {
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
          fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
          if (!fullName.trim()) throw new Error('Missing First Name/Last Name (or Full Name)');
          if (!isValidEmail(email)) throw new Error('Invalid or missing email');

          // Skip if an Auth account already exists for this email.
          let exists = false;
          try {
            await auth.getUserByEmail(email);
            exists = true;
          } catch (_) { /* not found → create */ }
          if (exists) {
            skipped++;
            results.push({ email, fullName, status: 'skipped', reason: 'Email already has an account' });
            continue;
          }

          const onHold = pick(row, 'Status').toLowerCase().includes('hold');
          const adminStatus = onHold ? 'on-hold' : 'active';
          const scholarshipStatus = onHold ? 'On Hold' : 'Active';
          const yearLevel = String(parseInt(pick(row, 'Year Level', 'Year'), 10) || 1);

          const totalScholarshipSemesters = parseInt(pick(row, 'Total Scholarship Semesters'), 10) || 0;
          const activeScholarshipSemesters = parseInt(pick(row, 'Active Scholarship Semesters'), 10) || 0;
          if (activeScholarshipSemesters < 1) throw new Error('Active Scholarship Semesters must be at least 1');
          const grantSchoolYear = computeGrantSchoolYear(currentTerm.yearStart, currentTerm.semesterIndex, activeScholarshipSemesters);
          const yearAwarded = Number(grantSchoolYear.split('-')[0]);
          // academicYear previously shared its value with yearAwarded (both
          // derived from the old computeGrantYear() approximation) — keep
          // that same coupling, now driven by the precise algorithm above.
          const academicYear = grantSchoolYear;

          const scholarId = `${yearPrefix}-${String(seq++).padStart(5, '0')}`;
          const suppliedScholarId = pick(row, 'Scholar ID');
          if (suppliedScholarId) {
            const dupSnap = await db.collection(COLLECTIONS.USERS).where('scholarId', '==', suppliedScholarId).limit(1).get();
            if (!dupSnap.empty) throw new Error(`Scholar ID ${suppliedScholarId} already exists`);
          }

          const password = generateTemporaryPassword(lastName, grantSchoolYear);

          const userRecord = await auth.createUser({
            email,
            password,
            displayName: fullName,
            emailVerified: true, // admin-provisioned → skip the verify-email gate
          });
          await auth.setCustomUserClaims(userRecord.uid, { role: ROLES.SCHOLAR });

          const now = new Date().toISOString();
          await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set({
            id: userRecord.uid,
            firstName,
            middleName,
            lastName,
            suffix: '',
            email,
            schoolName: pick(row, 'School', 'School Name', 'HEI'),
            academicProgram: pick(row, 'Program', 'Course', 'Academic Program'),
            academicYear,
            yearLevel,
            semester: '1st Semester',
            studentType: 'scholar',
            role: ROLES.SCHOLAR,
            scholarshipStatus,
            adminStatus,
            applicationStatus: 'approved',
            semestersCompleted: activeScholarshipSemesters,
            semestersUsed: activeScholarshipSemesters,
            scholarId: suppliedScholarId || scholarId, // existing auto-generated scholarId used only when not supplied
            uid: userRecord.uid,
            totalScholarshipSemesters,
            grantSchoolYear,
            yearAwarded, // replaces the old computeGrantYear() value — same field, new derivation
            mustChangePassword: true,
            activatedAt: null,
            lastLogin: null,
            passwordChangedAt: null,
            amountGranted: 0,
            emailVerified: true,
            status: 'active',
            createdAt: now,
            createdBy: 'bulk-import',
            source: 'bulkImport',
            // Profile fields left blank for the scholar to complete in-app.
            houseNo: '',
            street: '',
            barangay: '',
            city: '',
            province: '',
            gender: '',
            contactNumber: '',
          });

          created++;
          results.push({ email, fullName, scholarId: suppliedScholarId || scholarId, password, status: 'created' });
        } catch (e) {
          failed++;
          results.push({ email, fullName, status: 'failed', reason: e.message || 'Unknown error' });
        }
      }

      if (created > 0) {
        await writeAuditLog(db, {
          userId: 'admin-import',
          userEmail: '',
          userRole: ROLES.ADMIN,
          action: AUDIT_ACTIONS.CREATE,
          collection: COLLECTIONS.USERS,
          documentId: 'bulk-scholar-import',
          details: `Bulk-created ${created} scholar account(s) (${skipped} skipped, ${failed} failed)`,
        });
      }

      return res.json({ created, skipped, failed, total: rows.length, results });
    } catch (err) {
      return handleError(res, err, 'bulkCreateScholars');
    }
  }
);
