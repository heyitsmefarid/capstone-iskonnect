const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { getFirebaseAdmin } = require('../config/firebase');
const { COLLECTIONS } = require('../constants/collections');

const applicationTimeline = onDocumentWritten(
  'applications/{applicationId}',
  async (event) => {
    const after = event.data.after?.data();
    const before = event.data.before?.data();

    if (!after) {
      return;
    }

    const statusChanged = before?.status !== after.status;
    if (!statusChanged) {
      return;
    }

    const { db, fieldValue } = getFirebaseAdmin();
    const payload = {
      applicationId: event.params.applicationId,
      userId: after.userId || null,
      fromStatus: before?.status || null,
      toStatus: after.status,
      stage: 'application',
      createdAt: fieldValue.serverTimestamp(),
      createdBy: 'system',
    };

    await db.collection(COLLECTIONS.TIMELINE_ENTRIES).add(payload);
    logger.info('Application timeline entry created', payload);
  },
);

module.exports = {
  applicationTimeline,
};
