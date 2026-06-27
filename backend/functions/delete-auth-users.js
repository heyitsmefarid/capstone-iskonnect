// =============================================================================
//  Delete ALL Firebase Authentication users (anonymous + email accounts).
// =============================================================================
//  SETUP (one time):
//   1. Firebase Console -> Project Settings (gear) -> Service Accounts
//      -> "Generate new private key" -> save the file as:
//         backend/functions/serviceAccountKey.json
//   2. From this folder run:
//         node delete-auth-users.js
//
//  (firebase-admin is already installed here. Do NOT commit serviceAccountKey.json.)
// =============================================================================

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function run() {
  // 1) Collect every uid (listUsers pages up to 1000 at a time).
  const uids = [];
  let pageToken;
  do {
    const res = await admin.auth().listUsers(1000, pageToken);
    res.users.forEach((u) => uids.push(u.uid));
    pageToken = res.pageToken;
  } while (pageToken);

  if (uids.length === 0) {
    console.log('No Auth users to delete.');
    process.exit(0);
  }

  console.log(`Found ${uids.length} Auth users. Deleting...`);

  // 2) Delete in chunks of 1000 (deleteUsers limit).
  let deleted = 0;
  let failed = 0;
  for (let i = 0; i < uids.length; i += 1000) {
    const chunk = uids.slice(i, i + 1000);
    const result = await admin.auth().deleteUsers(chunk);
    deleted += result.successCount;
    failed += result.failureCount;
    console.log(`  ${deleted}/${uids.length} deleted (failures so far: ${failed})`);
  }

  console.log(`Done. Deleted ${deleted} accounts${failed ? `, ${failed} failed` : ''}.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
