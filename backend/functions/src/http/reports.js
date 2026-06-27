const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { COLLECTIONS } = require('../constants/collections');
const { authenticateRequest, requireRole } = require('../utils/requestAuth');
const { handleError } = require('../utils/errors');
const { writeAuditLog } = require('../utils/audit');
const FirebaseEnvironmentValidator = require('../utils/firebaseEnvironmentValidator');

function canBypassAuth() {
  const env = FirebaseEnvironmentValidator.detectEnvironment();
  return env === FirebaseEnvironmentValidator.ENVIRONMENTS.DEVELOPMENT ||
    env === FirebaseEnvironmentValidator.ENVIRONMENTS.EMULATOR;
}

async function resolveCount(queryRef) {
  try {
    const snapshot = await queryRef.count().get();
    if (typeof snapshot.count === 'number') {
      return snapshot.count;
    }

    const data = typeof snapshot.data === 'function' ? snapshot.data() : null;
    if (data && typeof data.count === 'number') {
      return data.count;
    }
  } catch (_) {
    // Fall through to full read fallback below.
  }

  const fullSnapshot = await queryRef.get();
  return fullSnapshot.size;
}

const getReportSummary = onRequest(async (req, res) => {
  if (req.method !== 'GET') {
    res.set('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authContext = await authenticateRequest(req, { allowPublic: canBypassAuth() });
  if (!authContext.ok) {
    return res.status(authContext.status).json({ error: authContext.error });
  }

  if (authContext.ok && authContext.user && !requireRole(authContext, ['admin', 'super_admin']) && !canBypassAuth()) {
    return res.status(403).json({ error: 'Insufficient role' });
  }

  try {
    const { db, fieldValue } = getFirebaseAdmin();

    const [applicationsCount, scholarsCount, attendanceCount, announcementsCount] = await Promise.all([
      resolveCount(db.collection(COLLECTIONS.APPLICATIONS)),
      resolveCount(db.collection(COLLECTIONS.SCHOLARSHIPS).where('status', '==', 'active_scholar')),
      resolveCount(db.collection(COLLECTIONS.ATTENDANCE_LOGS)),
      resolveCount(db.collection(COLLECTIONS.ANNOUNCEMENTS)),
    ]);

    const summary = {
      applications: applicationsCount,
      activeScholars: scholarsCount,
      attendanceLogs: attendanceCount,
      announcements: announcementsCount,
      generatedAt: new Date().toISOString(),
    };

    await db.collection(COLLECTIONS.REPORTS_CACHE).doc('latest').set(
      {
        ...summary,
        cachedAt: fieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await writeAuditLog({
      action: 'report_generated',
      actorId: authContext.user?.uid || 'dev-admin',
      actorRole: authContext.role,
      targetType: COLLECTIONS.REPORTS_CACHE,
      targetId: 'latest',
      details: summary,
    });

    return res.status(200).json({ ok: true, summary });
  } catch (error) {
    return handleError(res, error, 'getReportSummary');
  }
});

module.exports = {
  getReportSummary,
};
