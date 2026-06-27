const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const { getFirebaseAdmin } = require('../config/firebase');
const { COLLECTIONS } = require('../constants/collections');

const rollupReports = onSchedule('every day 02:00', async () => {
  const { db, fieldValue } = getFirebaseAdmin();

  const [applications, scholars, attendance, announcements] = await Promise.all([
    db.collection(COLLECTIONS.APPLICATIONS).count().get(),
    db.collection(COLLECTIONS.SCHOLARSHIPS).where('status', '==', 'active_scholar').count().get(),
    db.collection(COLLECTIONS.ATTENDANCE_LOGS).count().get(),
    db.collection(COLLECTIONS.ANNOUNCEMENTS).count().get(),
  ]);

  const summary = {
    applications: applications.count,
    activeScholars: scholars.count,
    attendanceLogs: attendance.count,
    announcements: announcements.count,
    generatedAt: new Date().toISOString(),
    cachedAt: fieldValue.serverTimestamp(),
  };

  await db.collection(COLLECTIONS.REPORTS_CACHE).doc('daily').set(summary, { merge: true });

  logger.info('Report summary rollup updated', summary);
});

module.exports = {
  rollupReports,
};
