const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { getFirebaseAdmin } = require('../config/firebase');
const { COLLECTIONS } = require('../constants/collections');

function calculateRiskLevel(record) {
  const gwa = Number(record?.gwa || 0);
  if (gwa === 0) {
    return 'unknown';
  }
  if (gwa > 3.0) {
    return 'critical';
  }
  if (gwa > 2.5) {
    return 'warning';
  }
  return 'good';
}

const academicMonitoring = onDocumentWritten(
  'academic_records/{recordId}',
  async (event) => {
    const after = event.data.after?.data();
    if (!after) {
      return;
    }

    const { db, fieldValue } = getFirebaseAdmin();
    const riskLevel = calculateRiskLevel(after);

    await db.collection(COLLECTIONS.PROFILES).doc(String(after.userId || after.scholarId)).set(
      {
        academicRiskLevel: riskLevel,
        latestGwa: after.gwa ?? null,
        updatedAt: fieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const payload = {
      recordId: event.params.recordId,
      userId: after.userId || after.scholarId || null,
      riskLevel,
      stage: 'academic_monitoring',
      createdAt: fieldValue.serverTimestamp(),
      createdBy: 'system',
    };

    await db.collection(COLLECTIONS.TIMELINE_ENTRIES).add(payload);
    logger.info('Academic monitoring update saved', payload);
  },
);

module.exports = {
  academicMonitoring,
};
