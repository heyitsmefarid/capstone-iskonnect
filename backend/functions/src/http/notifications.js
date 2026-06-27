const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { COLLECTIONS } = require('../constants/collections');
const { authenticateRequest, requireRole } = require('../utils/requestAuth');

const sendAnnouncementNotification = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authContext = await authenticateRequest(req);
  if (!authContext.ok) {
    return res.status(authContext.status).json({ error: authContext.error });
  }

  if (!requireRole(authContext, ['admin', 'super_admin'])) {
    return res.status(403).json({ error: 'Insufficient role' });
  }

  const body = req.body || {};
  const title = body.title || 'Announcement';
  const message = body.message || '';
  const audience = body.audience || 'all';
  const targetTokens = Array.isArray(body.targetTokens) ? body.targetTokens.filter(Boolean) : [];

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const { db, fieldValue, admin } = getFirebaseAdmin();
  const notificationDoc = await db.collection(COLLECTIONS.NOTIFICATIONS).add({
    type: 'announcement',
    title,
    message,
    audience,
    createdBy: authContext.user.uid,
    createdAt: fieldValue.serverTimestamp(),
  });

  let sentCount = 0;
  if (targetTokens.length) {
    const multicastResult = await admin.messaging().sendEachForMulticast({
      tokens: targetTokens,
      notification: { title, body: message },
      data: {
        type: 'announcement',
        notificationId: notificationDoc.id,
        audience,
      },
    });
    sentCount = multicastResult.successCount;
  }

  return res.status(201).json({
    ok: true,
    notificationId: notificationDoc.id,
    sentCount,
  });
});

module.exports = {
  sendAnnouncementNotification,
};
