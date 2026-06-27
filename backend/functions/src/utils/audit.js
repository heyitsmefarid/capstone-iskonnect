const { COLLECTIONS } = require('../constants/collections');
const { getFirebaseAdmin } = require('../config/firebase');

/**
 * Write an audit log entry.
 * Supports two call signatures:
 *   writeAuditLog(entry)                - legacy shape (actorId, actorRole, targetType, targetId)
 *   writeAuditLog(db, entry)            - new shape (userId, userEmail, userRole, collection, documentId)
 */
async function writeAuditLog(dbOrEntry, entryOrUndefined) {
  let dbInst;
  let entry;

  if (entryOrUndefined !== undefined) {
    // New signature: writeAuditLog(db, entry)
    dbInst = dbOrEntry;
    entry = entryOrUndefined;
  } else {
    // Legacy signature: writeAuditLog(entry)
    const { db } = getFirebaseAdmin();
    dbInst = db;
    entry = dbOrEntry;
  }

  const now = new Date().toISOString();

  const payload = {
    // Support both old and new field names
    action: entry.action || 'unknown',

    // Legacy fields
    actorId: entry.actorId || entry.userId || null,
    actorRole: entry.actorRole || entry.userRole || null,
    targetType: entry.targetType || entry.collection || null,
    targetId: entry.targetId || entry.documentId || null,

    // New extended fields
    userId: entry.userId || entry.actorId || null,
    userEmail: entry.userEmail || null,
    userRole: entry.userRole || entry.actorRole || null,
    collection: entry.collection || entry.targetType || null,
    documentId: entry.documentId || entry.targetId || null,
    details: typeof entry.details === 'string'
      ? { message: entry.details }
      : (entry.details || {}),

    timestamp: now,
    createdAt: now,
  };

  try {
    const { fieldValue } = getFirebaseAdmin();
    payload.createdAt = fieldValue.serverTimestamp();
  } catch (_) {
    // fieldValue not available in test contexts — keep ISO string
  }

  await dbInst.collection(COLLECTIONS.AUDIT_LOGS).add(payload);
}

module.exports = { writeAuditLog };
