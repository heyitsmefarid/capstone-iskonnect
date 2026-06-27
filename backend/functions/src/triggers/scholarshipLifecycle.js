const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { getFirebaseAdmin } = require('../config/firebase');
const { COLLECTIONS } = require('../constants/collections');

const TERMINAL_STATUSES = new Set(['graduated', 'terminated']);

const ALLOWED_TRANSITIONS = {
  applied: new Set(['screened', 'terminated']),
  screened: new Set(['interviewed', 'terminated']),
  interviewed: new Set(['approved', 'terminated']),
  approved: new Set(['active_scholar', 'terminated']),
  active_scholar: new Set(['probation', 'graduated', 'terminated']),
  probation: new Set(['active_scholar', 'terminated', 'graduated']),
  graduated: new Set([]),
  terminated: new Set([]),
};

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isCorrectionEvent(beforeStatus, afterStatus, afterData) {
  return afterData?.lifecycle?.correctedBy === 'system' &&
    afterData?.lifecycle?.correctedFromStatus === beforeStatus &&
    afterData?.lifecycle?.correctedToStatus === afterStatus;
}

function isValidTransition(beforeStatus, afterStatus) {
  if (!beforeStatus || beforeStatus === afterStatus) {
    return true;
  }

  const allowedTargets = ALLOWED_TRANSITIONS[beforeStatus];
  if (!allowedTargets) {
    return false;
  }

  return allowedTargets.has(afterStatus);
}

const scholarshipLifecycle = onDocumentWritten(
  'scholarships/{scholarshipId}',
  async (event) => {
    const after = event.data.after?.data();
    const before = event.data.before?.data();

    if (!after) {
      return;
    }

    const beforeStatus = normalizeStatus(before?.status);
    const afterStatus = normalizeStatus(after.status);
    const statusChanged = beforeStatus !== afterStatus;
    if (!statusChanged) {
      return;
    }

    if (isCorrectionEvent(beforeStatus, afterStatus, after)) {
      return;
    }

    const { db, fieldValue } = getFirebaseAdmin();

    if (!isValidTransition(beforeStatus, afterStatus)) {
      const docRef = event.data.after.ref;
      await docRef.set(
        {
          status: beforeStatus || after.status,
          lifecycle: {
            correctedBy: 'system',
            correctedAt: fieldValue.serverTimestamp(),
            correctedFromStatus: afterStatus,
            correctedToStatus: beforeStatus || after.status,
            lastInvalidTransition: {
              fromStatus: beforeStatus || null,
              toStatus: afterStatus,
              reason: 'invalid_transition',
              recordedAt: fieldValue.serverTimestamp(),
            },
          },
          updatedAt: fieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      logger.warn('Invalid scholarship lifecycle transition corrected', {
        scholarshipId: event.params.scholarshipId,
        fromStatus: beforeStatus || null,
        toStatus: afterStatus,
      });
      return;
    }

    const completionPatch = {};
    if (TERMINAL_STATUSES.has(afterStatus)) {
      completionPatch.completionStatus = afterStatus;
      completionPatch.completionDate = after.completionDate || fieldValue.serverTimestamp();
      completionPatch.completionRemarks = after.completionRemarks || null;
      completionPatch.exitReason = after.exitReason || null;
      completionPatch.updatedAt = fieldValue.serverTimestamp();
    }

    if (Object.keys(completionPatch).length > 0) {
      await event.data.after.ref.set(completionPatch, { merge: true });
    }

    const payload = {
      scholarshipId: event.params.scholarshipId,
      userId: after.userId || null,
      fromStatus: beforeStatus || null,
      toStatus: afterStatus,
      stage: 'scholarship',
      createdAt: fieldValue.serverTimestamp(),
      createdBy: 'system',
      completionStatus: TERMINAL_STATUSES.has(afterStatus) ? afterStatus : null,
      completionDate: TERMINAL_STATUSES.has(afterStatus)
        ? (after.completionDate || fieldValue.serverTimestamp())
        : null,
      completionRemarks: TERMINAL_STATUSES.has(afterStatus)
        ? (after.completionRemarks || null)
        : null,
      exitReason: TERMINAL_STATUSES.has(afterStatus)
        ? (after.exitReason || null)
        : null,
    };

    await db.collection(COLLECTIONS.TIMELINE_ENTRIES).add(payload);
    logger.info('Scholarship lifecycle entry created', payload);
  },
);

module.exports = {
  scholarshipLifecycle,
};
