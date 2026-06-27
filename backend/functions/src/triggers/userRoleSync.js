const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { getFirebaseAdmin } = require('../config/firebase');
const { COLLECTIONS } = require('../constants/collections');
const { normalizeRole } = require('../utils/auth');

const userRoleSync = onDocumentWritten('users/{userId}', async (event) => {
  const after = event.data.after?.data();
  if (!after) {
    return;
  }

  const role = normalizeRole(after.role);
  if (!role) {
    return;
  }

  const { auth, db, fieldValue } = getFirebaseAdmin();
  await auth.setCustomUserClaims(event.params.userId, { role });

  await db.collection(COLLECTIONS.PROFILES).doc(event.params.userId).set(
    {
      role,
      updatedAt: fieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  logger.info('User role synced to custom claims', {
    userId: event.params.userId,
    role,
  });
});

module.exports = {
  userRoleSync,
};
