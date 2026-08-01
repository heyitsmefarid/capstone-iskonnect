// Automatic scheduled database backup — runs as a Render Cron Job (see
// render.yaml's `iskonnect-scheduled-backup` service), separate from the
// always-on `local-form-server.js` web service.
//
// Cron Jobs run once, on their own schedule, and exit — unlike a web
// service's free plan, they aren't affected by idle-sleep, so this is the
// reliable place for anything that must run even when no admin has the
// browser open. This script itself runs DAILY (see render.yaml's
// `schedule`), and just checks whether a backup is actually due yet based on
// the admin's chosen frequency (weekly/monthly/off) — a lighter, self-healing
// alternative to trying to schedule the exact weekly/monthly cron expression
// directly: if a run is ever missed (a Render outage, a bad deploy), the very
// next day's check catches it as overdue instead of silently skipping a
// whole cycle.
//
// Storage destination: this Firebase project has NO Cloud Storage bucket
// provisioned (verified directly against the GCP project — zero buckets
// exist, and creating one requires the Blaze plan), so backups are written
// as documents in a `scheduled_backups` Firestore collection instead —
// stays entirely within infrastructure this project already runs on.
// `audit_logs` is deliberately excluded here: it alone is over 1MB (a
// single Firestore document's hard size limit) and isn't essential for a
// disaster-recovery restore; the manual "Download Backup" button in
// admin-ui still includes it for one-off downloads. Old runs are pruned
// (see RETAIN_RUNS) so this collection doesn't grow forever.
//
// Requires the `FIREBASE_SERVICE_ACCOUNT` env var — the full JSON contents of
// a Firebase service account key (Project Settings > Service Accounts >
// Generate New Private Key), set as a secret in the Render dashboard. Never
// commit this key to the repo — see .gitignore's serviceAccountKey.json rule.

const admin = require('firebase-admin');

// Same set of collections as admin-ui's manual Backup & Restore page
// (admin-ui/src/utils/backupRestore.js) MINUS audit_logs — kept in sync by
// hand since this script runs in a separate Node project (backend/functions)
// with its own package.json/node_modules, not a shared workspace.
const BACKUP_COLLECTIONS = [
  'users',
  'school_years',
  'schools',
  'programs',
  'announcements',
  'events',
  'messages',
  'group_chats',
  'system_config',
  'applicant_history',
  'scholar_history',
  'scholarship_applications',
];

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_AFTER_MS = { weekly: 7 * DAY_MS, monthly: 30 * DAY_MS };
const RETAIN_RUNS = 12; // ~3 months of weekly runs, or a year of monthly runs
const MAX_DOC_BYTES = 900 * 1024; // Firestore's hard cap is 1 MiB; stay well under it

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set — see this file\'s header comment.');
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
  }
}

async function writeAuditLog(db, { action, details }) {
  const id = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  await db.collection('audit_logs').doc(id).set({
    action,
    collection: 'ALL',
    documentId: null,
    details: { message: details },
    userId: 'automatic-scheduled-backup',
    userEmail: 'automatic-scheduled-backup',
    userRole: 'system',
    timestamp: now,
    createdAt: now,
  });
}

// Deletes every scheduled_backups doc beyond the newest RETAIN_RUNS, so this
// collection stays bounded instead of growing forever.
async function pruneOldRuns(db) {
  const snap = await db.collection('scheduled_backups').orderBy('createdAt', 'desc').get();
  const toDelete = snap.docs.slice(RETAIN_RUNS);
  if (toDelete.length === 0) return 0;
  const batch = db.batch();
  toDelete.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return toDelete.length;
}

async function main() {
  const serviceAccount = loadServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  const scheduleRef = db.collection('system_config').doc('backupSchedule');
  const scheduleSnap = await scheduleRef.get();
  const schedule = scheduleSnap.exists ? scheduleSnap.data() : {};
  const frequency = schedule.frequency || 'off';

  if (frequency !== 'weekly' && frequency !== 'monthly') {
    console.log(`Automatic backups are off (frequency="${frequency}"). Nothing to do.`);
    return;
  }

  const lastRunAt = schedule.lastRunAt ? new Date(schedule.lastRunAt) : null;
  const now = new Date();
  if (lastRunAt && !Number.isNaN(lastRunAt.getTime())) {
    const elapsed = now.getTime() - lastRunAt.getTime();
    if (elapsed < DUE_AFTER_MS[frequency]) {
      const dueInDays = Math.ceil((DUE_AFTER_MS[frequency] - elapsed) / DAY_MS);
      console.log(`Not due yet — last ${frequency} backup ran ${lastRunAt.toISOString()}, due again in ~${dueInDays} day(s).`);
      return;
    }
  }

  console.log(`Backup is due (frequency="${frequency}", last ran ${lastRunAt ? lastRunAt.toISOString() : 'never'}). Starting…`);

  const collectionsData = {};
  let totalDocuments = 0;
  for (const name of BACKUP_COLLECTIONS) {
    const snap = await db.collection(name).get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    collectionsData[name] = docs;
    totalDocuments += docs.length;
    console.log(`  ${name}: ${docs.length} document(s)`);
  }

  const payload = {
    formatVersion: 1,
    exportedAt: now.toISOString(),
    exportedBy: `automatic-${frequency}-backup`,
    totalDocuments,
    collections: collectionsData,
  };

  const payloadSize = Buffer.byteLength(JSON.stringify(payload));
  if (payloadSize > MAX_DOC_BYTES) {
    throw new Error(
      `Backup payload is ${(payloadSize / 1024).toFixed(0)}KB, over the ${(MAX_DOC_BYTES / 1024).toFixed(0)}KB safety threshold ` +
      `(Firestore's hard limit is 1MiB per document). The database has grown enough that this script needs to be split across ` +
      `multiple documents — do not ignore this error, the write below would fail anyway.`
    );
  }

  const runId = now.toISOString().replace(/[:.]/g, '-');
  await db.collection('scheduled_backups').doc(runId).set(payload);
  console.log(`Wrote scheduled_backups/${runId} (${totalDocuments} documents, ${(payloadSize / 1024).toFixed(0)}KB).`);

  const pruned = await pruneOldRuns(db);
  if (pruned > 0) console.log(`Pruned ${pruned} run(s) beyond the newest ${RETAIN_RUNS}.`);

  await scheduleRef.set(
    {
      frequency,
      lastRunAt: now.toISOString(),
      lastRunTotalDocuments: totalDocuments,
      lastRunDocId: runId,
    },
    { merge: true }
  );

  await writeAuditLog(db, {
    action: 'EXPORT',
    details: `Automatic ${frequency} backup completed (${totalDocuments} document(s) across ${BACKUP_COLLECTIONS.length} collections, excludes audit_logs) → scheduled_backups/${runId}`,
  });

  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Scheduled backup failed:', err);
    process.exit(1);
  });
