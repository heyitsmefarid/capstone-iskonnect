const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { getFirebaseAdmin } = require('../config/firebase');
const { COLLECTIONS } = require('../constants/collections');
const { writeAuditLog } = require('../utils/audit');

const messageNotifications = onDocumentCreated(
  'messages/{messageId}',
  async (event) => {
    try {
      const message = event.data?.data();
      if (!message) {
        return;
      }

      const { db, fieldValue, admin } = getFirebaseAdmin();
      const notificationPayload = {
        messageId: event.params.messageId,
        fromUserId: message.fromUserId || null,
        toUserId: message.toUserId || null,
        title: message.subject || 'New Message',
        message: message.body || '',
        createdAt: fieldValue.serverTimestamp(),
        createdBy: 'system',
      };

      await db.collection(COLLECTIONS.NOTIFICATIONS).add(notificationPayload);

      const targetTokens = Array.isArray(message.targetTokens) ? message.targetTokens.filter(Boolean) : [];
      if (targetTokens.length) {
        await admin.messaging().sendEachForMulticast({
          tokens: targetTokens,
          notification: {
            title: notificationPayload.title,
            body: notificationPayload.message,
          },
          data: {
            type: 'message',
            messageId: event.params.messageId,
          },
        });
      }

      await writeAuditLog({
        action: 'message_created',
        actorId: message.fromUserId || null,
        actorRole: message.fromUserRole || null,
        targetType: COLLECTIONS.MESSAGES,
        targetId: event.params.messageId,
        details: {
          toUserId: message.toUserId || null,
          notifiedCount: targetTokens.length,
        },
      });

      logger.info('Message notification created', notificationPayload);
    } catch (error) {
      logger.error('Message notification trigger failed', {
        messageId: event.params?.messageId,
        error: error?.message || String(error),
      });
    }
  },
);

module.exports = {
  messageNotifications,
};
