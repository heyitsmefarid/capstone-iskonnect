const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { authenticateRequest, requireRole } = require('../utils/requestAuth');
const { handleError } = require('../utils/errors');
const { COLLECTIONS, ROLES } = require('../constants/collections');
const { writeAuditLog } = require('../utils/audit');

function isAdminOrStaff(role) {
  return [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.STAFF].includes(role);
}

// POST /manageGroupChat — create, addMembers, removeMembers, archive, update
exports.manageGroupChat = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { db } = getFirebaseAdmin();
    const { action, groupId, data } = req.body || {};
    const now = new Date().toISOString();
    let docId = groupId;

    if (action === 'create') {
      if (!isAdminOrStaff(ctx.role)) {
        return res.status(403).json({ error: 'Only staff or admin can create group chats' });
      }
      const { name, memberIds = [], description = '' } = data || {};
      if (!name) return res.status(400).json({ error: 'Group name required' });

      const allMembers = [...new Set([ctx.user.uid, ...memberIds])];
      const ref = db.collection(COLLECTIONS.GROUP_CHATS).doc();
      docId = ref.id;
      await ref.set({
        name,
        description,
        memberIds: allMembers,
        createdBy: ctx.user.uid,
        createdAt: now,
        isArchived: false,
        lastMessageAt: null,
        lastMessage: null,
      });

      await writeAuditLog(db, {
        userId: ctx.user.uid,
        userEmail: ctx.user.email,
        userRole: ctx.role,
        action: 'CREATE',
        collection: COLLECTIONS.GROUP_CHATS,
        documentId: docId,
        details: `Group chat "${name}" created with ${allMembers.length} members`,
      });
    } else if (action === 'addMembers') {
      if (!docId) return res.status(400).json({ error: 'groupId required' });
      if (!isAdminOrStaff(ctx.role)) return res.status(403).json({ error: 'Forbidden' });

      const groupDoc = await db.collection(COLLECTIONS.GROUP_CHATS).doc(docId).get();
      if (!groupDoc.exists) return res.status(404).json({ error: 'Group not found' });

      const existing = groupDoc.data().memberIds || [];
      const merged = [...new Set([...existing, ...(data?.memberIds || [])])];
      await db.collection(COLLECTIONS.GROUP_CHATS).doc(docId).update({ memberIds: merged, updatedAt: now });
    } else if (action === 'removeMembers') {
      if (!docId) return res.status(400).json({ error: 'groupId required' });
      if (!isAdminOrStaff(ctx.role)) return res.status(403).json({ error: 'Forbidden' });

      const groupDoc = await db.collection(COLLECTIONS.GROUP_CHATS).doc(docId).get();
      if (!groupDoc.exists) return res.status(404).json({ error: 'Group not found' });

      const filtered = (groupDoc.data().memberIds || []).filter(
        m => !(data?.memberIds || []).includes(m)
      );
      await db.collection(COLLECTIONS.GROUP_CHATS).doc(docId).update({ memberIds: filtered, updatedAt: now });
    } else if (action === 'archive') {
      if (!docId) return res.status(400).json({ error: 'groupId required' });
      if (!isAdminOrStaff(ctx.role)) return res.status(403).json({ error: 'Forbidden' });

      await db.collection(COLLECTIONS.GROUP_CHATS).doc(docId).update({
        isArchived: true,
        archivedAt: now,
        archivedBy: ctx.user.uid,
      });

      await writeAuditLog(db, {
        userId: ctx.user.uid,
        userEmail: ctx.user.email,
        userRole: ctx.role,
        action: 'UPDATE',
        collection: COLLECTIONS.GROUP_CHATS,
        documentId: docId,
        details: 'Group chat archived',
      });
    } else if (action === 'update') {
      if (!docId) return res.status(400).json({ error: 'groupId required' });
      if (!isAdminOrStaff(ctx.role)) return res.status(403).json({ error: 'Forbidden' });

      await db.collection(COLLECTIONS.GROUP_CHATS).doc(docId).update({
        ...data,
        updatedAt: now,
        updatedBy: ctx.user.uid,
      });
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    return res.json({ success: true, id: docId });
  } catch (err) {
    return handleError(res, err, 'manageGroupChat');
  }
});

// POST /sendGroupMessage
exports.sendGroupMessage = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { db } = getFirebaseAdmin();
    const { groupId, message, attachmentUrl } = req.body || {};
    if (!groupId || !message) return res.status(400).json({ error: 'groupId and message required' });

    const groupDoc = await db.collection(COLLECTIONS.GROUP_CHATS).doc(groupId).get();
    if (!groupDoc.exists) return res.status(404).json({ error: 'Group not found' });

    const group = groupDoc.data();
    if (group.isArchived) return res.status(400).json({ error: 'Cannot send to archived group' });
    if (!group.memberIds.includes(ctx.user.uid)) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const now = new Date().toISOString();
    const msgRef = db
      .collection(COLLECTIONS.GROUP_CHATS)
      .doc(groupId)
      .collection('messages')
      .doc();

    await Promise.all([
      msgRef.set({
        senderId: ctx.user.uid,
        senderEmail: ctx.user.email,
        senderRole: ctx.role,
        message,
        attachmentUrl: attachmentUrl || null,
        sentAt: now,
        readBy: [ctx.user.uid],
      }),
      db.collection(COLLECTIONS.GROUP_CHATS).doc(groupId).update({
        lastMessage: message.substring(0, 100),
        lastMessageAt: now,
        lastMessageBy: ctx.user.uid,
      }),
    ]);

    return res.json({ success: true, messageId: msgRef.id });
  } catch (err) {
    return handleError(res, err, 'sendGroupMessage');
  }
});

// GET /getGroupMessages — paginated message history
exports.getGroupMessages = onRequest({ cors: true }, async (req, res) => {
  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) return res.status(ctx.status || 401).json({ error: ctx.error });

    const { db } = getFirebaseAdmin();
    const { groupId, limit = 50, before } = req.query || {};
    if (!groupId) return res.status(400).json({ error: 'groupId required' });

    const groupDoc = await db.collection(COLLECTIONS.GROUP_CHATS).doc(groupId).get();
    if (!groupDoc.exists) return res.status(404).json({ error: 'Group not found' });
    if (!groupDoc.data().memberIds.includes(ctx.user.uid)) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    let query = db
      .collection(COLLECTIONS.GROUP_CHATS)
      .doc(groupId)
      .collection('messages')
      .orderBy('sentAt', 'desc')
      .limit(Number(limit));

    if (before) {
      const beforeDoc = await db
        .collection(COLLECTIONS.GROUP_CHATS)
        .doc(groupId)
        .collection('messages')
        .doc(before)
        .get();
      if (beforeDoc.exists) query = query.startAfter(beforeDoc);
    }

    const snap = await query.get();
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();

    return res.json({ messages });
  } catch (err) {
    return handleError(res, err, 'getGroupMessages');
  }
});
