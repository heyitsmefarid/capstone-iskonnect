const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { COLLECTIONS } = require('../constants/collections');
const { authenticateRequest, requireRole } = require('../utils/requestAuth');
const { buildRequirementStoragePath } = require('../utils/storagePaths');
const { writeAuditLog } = require('../utils/audit');
const FirebaseEnvironmentValidator = require('../utils/firebaseEnvironmentValidator');

const ALLOWED_REVIEW_STATUSES = new Set(['under_review', 'approved', 'rejected']);

async function writeTimelineEntry(db, fieldValue, payload) {
  await db.collection(COLLECTIONS.TIMELINE_ENTRIES).add({
    ...payload,
    createdAt: fieldValue.serverTimestamp(),
    createdBy: payload.createdBy || 'system',
  });
}

function canBypassAuth() {
  const env = FirebaseEnvironmentValidator.detectEnvironment();
  return env === FirebaseEnvironmentValidator.ENVIRONMENTS.DEVELOPMENT ||
    env === FirebaseEnvironmentValidator.ENVIRONMENTS.EMULATOR;
}

const submitRequirement = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authContext = await authenticateRequest(req);
  if (!authContext.ok && !canBypassAuth()) {
    return res.status(authContext.status).json({ error: authContext.error });
  }

  if (authContext.ok && !requireRole(authContext, ['applicant', 'scholar'])) {
    return res.status(403).json({ error: 'Insufficient role' });
  }

  const body = req.body || {};
  const applicationId = body.applicationId || null;
  const requirementType = body.requirementType || null;
  const fileName = body.fileName || 'upload';
  const fileType = body.fileType || null;
  const fileUrl = body.fileUrl || null;
  const notes = body.notes || null;
  const submittedAt = body.submittedAt || new Date().toISOString();
  const actorId = authContext.user?.uid || body.userId || 'dev-user';
  const actorRole = authContext.role || 'system';

  if (!applicationId || !requirementType || !fileUrl) {
    return res.status(400).json({
      error: 'applicationId, requirementType, and fileUrl are required',
    });
  }

  const { db, fieldValue } = getFirebaseAdmin();
  const storagePath = buildRequirementStoragePath({
    applicationId,
    userId: actorId,
    requirementType,
    fileName,
  });

  const requirementDocId = String(requirementType).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const requirementRef = db.collection(COLLECTIONS.APPLICATIONS).doc(applicationId).collection('requirements').doc(requirementDocId);
  const existingSnap = await requirementRef.get();
  const previousStatus = existingSnap.exists ? existingSnap.data()?.status || null : null;
  const nextStatus = previousStatus === 'rejected' ? 'resubmitted' : 'submitted';

  await requirementRef.set({
    applicationId,
    userId: actorId,
    requirementType,
    fileName,
    fileType,
    fileUrl,
    storagePath,
    notes,
    status: nextStatus,
    submittedAt,
    createdAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection(COLLECTIONS.APPLICATIONS).doc(applicationId).set(
    {
      lastRequirementSubmittedAt: fieldValue.serverTimestamp(),
      updatedAt: fieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await writeTimelineEntry(db, fieldValue, {
    applicationId,
    userId: actorId,
    stage: 'requirements',
    action: 'submitted',
    requirementType,
    fromStatus: previousStatus,
    toStatus: nextStatus,
    createdBy: actorId,
  });

  await writeAuditLog({
    action: 'requirement_submitted',
    actorId,
    actorRole,
    targetType: COLLECTIONS.APPLICATIONS,
    targetId: applicationId,
    details: {
      requirementType,
      fileName,
      fileType,
      storagePath,
      previousStatus,
      nextStatus,
    },
  });

  return res.status(201).json({
    ok: true,
    requirementId: requirementDocId,
    status: nextStatus,
    storagePath,
  });
});

const listRequirements = onRequest(async (req, res) => {
  if (req.method !== 'GET') {
    res.set('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authContext = await authenticateRequest(req, { allowPublic: canBypassAuth() });
  if (!authContext.ok) {
    return res.status(authContext.status).json({ error: authContext.error });
  }

  const applicationId = req.query.applicationId || null;
  if (!applicationId) {
    return res.status(400).json({ error: 'applicationId is required' });
  }

  const requestedUserId = req.query.userId || null;
  const isAdmin = requireRole(authContext, ['admin', 'super_admin']);
  const userId = isAdmin ? requestedUserId : authContext.user?.uid || requestedUserId || null;

  if (!isAdmin && requestedUserId && authContext.user?.uid && requestedUserId !== authContext.user.uid) {
    return res.status(403).json({ error: 'Insufficient role' });
  }

  const { db } = getFirebaseAdmin();
  let query = db.collection(COLLECTIONS.APPLICATIONS).doc(applicationId).collection('requirements');
  if (userId) {
    query = query.where('userId', '==', userId);
  }

  const snap = await query.orderBy('updatedAt', 'desc').get();
  const requirements = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return res.status(200).json({ ok: true, requirements });
});

const reviewRequirement = onRequest(async (req, res) => {
  if (req.method !== 'PATCH') {
    res.set('Allow', 'PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authContext = await authenticateRequest(req, { allowPublic: canBypassAuth() });
  if (!authContext.ok) {
    return res.status(authContext.status).json({ error: authContext.error });
  }

  if (authContext.ok && authContext.user && !requireRole(authContext, ['admin', 'super_admin']) && !canBypassAuth()) {
    return res.status(403).json({ error: 'Insufficient role' });
  }

  const body = req.body || {};
  const applicationId = body.applicationId || null;
  const requirementId = body.requirementId || null;
  const status = String(body.status || '').toLowerCase();
  const reviewNotes = body.reviewNotes || null;

  if (!applicationId || !requirementId || !ALLOWED_REVIEW_STATUSES.has(status)) {
    return res.status(400).json({
      error: 'applicationId, requirementId, and valid status are required',
      allowedStatuses: Array.from(ALLOWED_REVIEW_STATUSES),
    });
  }

  const { db, fieldValue } = getFirebaseAdmin();
  const requirementRef = db
    .collection(COLLECTIONS.APPLICATIONS)
    .doc(applicationId)
    .collection('requirements')
    .doc(requirementId);

  const requirementSnap = await requirementRef.get();
  if (!requirementSnap.exists) {
    return res.status(404).json({ error: 'Requirement not found' });
  }

  const currentData = requirementSnap.data() || {};
  const previousStatus = currentData.status || null;

  await requirementRef.set(
    {
      status,
      reviewNotes,
      reviewedBy: authContext.user?.uid || 'dev-admin',
      reviewedAt: fieldValue.serverTimestamp(),
      updatedAt: fieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await writeTimelineEntry(db, fieldValue, {
    applicationId,
    userId: currentData.userId || null,
    stage: 'requirements',
    action: 'reviewed',
    requirementType: currentData.requirementType || null,
    fromStatus: previousStatus,
    toStatus: status,
    reviewedBy: authContext.user?.uid || 'dev-admin',
    createdBy: authContext.user?.uid || 'dev-admin',
  });

  await writeAuditLog({
    action: 'requirement_reviewed',
    actorId: authContext.user?.uid || 'dev-admin',
    actorRole: authContext.role,
    targetType: COLLECTIONS.APPLICATIONS,
    targetId: applicationId,
    details: {
      requirementId,
      previousStatus,
      status,
      reviewNotes,
    },
  });

  return res.status(200).json({
    ok: true,
    requirementId,
    previousStatus,
    status,
  });
});

module.exports = {
  submitRequirement,
  listRequirements,
  reviewRequirement,
};
