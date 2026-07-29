'use strict';

/* eslint-disable no-console */

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
  const { auth, db, admin } = getFirebaseAdmin();
  // NB: getFirebaseAdmin()'s `fieldValue` wrapper only exposes
  // `serverTimestamp()` (see src/config/firebase.js) — it has no `delete()`.
  // We use the raw admin SDK sentinel via the `admin` handle instead, rather
  // than widening that shared wrapper for a one-time script.
  const deleteField = admin.firestore.FieldValue.delete();

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
        password: deleteField,
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
