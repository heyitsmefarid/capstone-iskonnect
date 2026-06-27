'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { AppError, handleError } = require('../utils/errors');
const { COLLECTIONS, ROLES, AUDIT_ACTIONS } = require('../constants/collections');
const { writeAuditLog } = require('../utils/audit');
const { isValidEmail } = require('../utils/validation');

// The admin panel signs in to Firebase ANONYMOUSLY (its admin/staff login is an
// app-level session, not a Firebase identity with an admin claim), so this
// endpoint can't be gated by an admin ID token like the other management
// functions. Instead it requires a shared secret in the `x-admin-key` header.
// Override in production via the ADMIN_IMPORT_KEY function env var.
const ADMIN_IMPORT_KEY = process.env.ADMIN_IMPORT_KEY || 'ced-admin-import-2026';

// Academic year granted is derived from how many semesters a scholar has
// already used (2 semesters = 1 academic year).
const SEMESTERS_PER_YEAR = 2;

// Temporary password = capitalized last name + this fixed, policy-compliant
// suffix (upper + lower + digit + special, >= 8 chars). e.g. "Gallano@Ced2026".
const PASSWORD_SUFFIX = '@Ced2026';

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

function makePassword(lastName, firstName) {
  const base = String(lastName || firstName || 'Scholar').replace(/[^a-zA-Z]/g, '');
  const cap = base ? base[0].toUpperCase() + base.slice(1).toLowerCase() : 'Scholar';
  return `${cap}${PASSWORD_SUFFIX}`;
}

function computeGrantYear(semesters) {
  const now = new Date().getFullYear();
  const yearsElapsed = Math.floor((Number(semesters) || 0) / SEMESTERS_PER_YEAR);
  return now - yearsElapsed;
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
// Body: { rows: [{ "Full Name", "Email", "School", "Program", "Year Level",
//                  "Number of Semesters", "Status" }, ...] }
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

      let created = 0;
      let skipped = 0;
      let failed = 0;
      const results = [];

      for (const row of rows) {
        const fullName = pick(row, 'Full Name', 'Name', 'Scholar Name');
        const email = pick(row, 'Email', 'Email Address').toLowerCase();
        try {
          if (!fullName) throw new Error('Missing Full Name');
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

          const { firstName, middleName, lastName } = splitName(fullName);
          const password = makePassword(lastName, firstName);
          const onHold = pick(row, 'Status').toLowerCase().includes('hold');
          const adminStatus = onHold ? 'on-hold' : 'active';
          const scholarshipStatus = onHold ? 'On Hold' : 'Active';
          const semesters = parseInt(pick(row, 'Number of Semesters', 'No. of Semesters', 'Semesters'), 10) || 0;
          const yearLevel = String(parseInt(pick(row, 'Year Level', 'Year'), 10) || 1);
          const grantYear = computeGrantYear(semesters);
          const academicYear = `${grantYear}-${grantYear + 1}`;
          const scholarId = `${yearPrefix}-${String(seq++).padStart(5, '0')}`;

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
            semestersCompleted: semesters,
            semestersUsed: semesters,
            scholarId,
            yearAwarded: grantYear,
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
          results.push({ email, fullName, scholarId, password, status: 'created' });
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
