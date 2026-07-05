const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { getFirebaseAdmin } = require('../config/firebase');
const { COLLECTIONS } = require('../constants/collections');

const attendanceMonitoring = onDocumentWritten(
  'attendance_logs/{logId}',
  async (event) => {
    const after = event.data.after?.data();
    if (!after) {
      return;
    }

    // The QR scanner writes each scan to a deterministic doc id and retries
    // (via a merge) if the scholar record wasn't resolvable yet. Only treat
    // the first write as a new attendance event — otherwise every retry of
    // the same scan re-touches `profiles` and adds another `timeline_entries`
    // doc for something that already happened.
    const before = event.data.before?.data();
    if (before) {
      return;
    }

    const { db, fieldValue } = getFirebaseAdmin();
    const scholarDocId = String(after.scholarId || after.userId || 'unknown');

    await db.collection(COLLECTIONS.PROFILES).doc(scholarDocId).set(
      {
        lastAttendanceAt: after.attendedAt || null,
        updatedAt: fieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const payload = {
      logId: event.params.logId,
      userId: after.userId || after.scholarId || null,
      eventId: after.eventId || null,
      stage: 'attendance',
      createdAt: fieldValue.serverTimestamp(),
      createdBy: 'system',
    };

    await db.collection(COLLECTIONS.TIMELINE_ENTRIES).add(payload);
    logger.info('Attendance monitoring update saved', payload);
  },
);

module.exports = {
  attendanceMonitoring,
};
