const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { getFirebaseAdmin } = require('../config/firebase');
const { COLLECTIONS } = require('../constants/collections');
const { writeAuditLog } = require('../utils/audit');

const announcementNotifications = onDocumentCreated(
  'announcements/{announcementId}',
  async (event) => {
    const announcement = event.data?.data();
    if (!announcement) {
      return;
    }

    const { db, fieldValue, admin } = getFirebaseAdmin();
    const payload = {
      announcementId: event.params.announcementId,
      title: announcement.title || 'Announcement',
      audience: announcement.audience || 'all',
      createdAt: fieldValue.serverTimestamp(),
      createdBy: 'system',
    };

    await db.collection(COLLECTIONS.NOTIFICATIONS).add(payload);

    const targetTokens = Array.isArray(announcement.targetTokens)
      ? announcement.targetTokens.filter(Boolean)
      : [];

    if (targetTokens.length) {
      await admin.messaging().sendEachForMulticast({
        tokens: targetTokens,
        notification: {
          title: payload.title,
          body: announcement.message || announcement.body || '',
        },
        data: {
          type: 'announcement',
          announcementId: event.params.announcementId,
        },
      });
    }

    await writeAuditLog({
      action: 'announcement_created',
      actorId: announcement.createdBy || null,
      actorRole: announcement.createdByRole || null,
      targetType: COLLECTIONS.ANNOUNCEMENTS,
      targetId: event.params.announcementId,
      details: {
        audience: announcement.audience || 'all',
        notifiedCount: targetTokens.length,
      },
    });

    logger.info('Announcement notification queued', payload);
  },
);

module.exports = {
  announcementNotifications,
};
