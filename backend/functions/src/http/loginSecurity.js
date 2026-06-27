'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { authenticateRequest } = require('../utils/requestAuth');
const { AppError, handleError } = require('../utils/errors');
const { isValidEmail } = require('../utils/validation');
const { checkLoginLock, recordFailedAttempt, clearLoginAttempts } = require('../utils/loginRateLimit');
const { COLLECTIONS, AUDIT_ACTIONS } = require('../constants/collections');
const { writeAuditLog } = require('../utils/audit');

// ── GET /checkLoginStatus?email= ─────────────────────────────────────────────
// Public endpoint — called by client before attempting login to warn user of lockout.

exports.checkLoginStatus = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.query || {};

    if (!email || !isValidEmail(email)) {
      throw new AppError('A valid email address is required.', 400, 'INVALID_EMAIL');
    }

    const status = await checkLoginLock(email.trim().toLowerCase());

    return res.json({
      locked:          status.locked,
      lockedUntil:     status.lockedUntil || null,
      remainingMinutes: status.remainingMinutes || null,
      remaining:       status.remaining ?? null,
      message:         status.message || null,
    });
  } catch (err) {
    return handleError(res, err, 'checkLoginStatus');
  }
});

// ── POST /recordLoginFailure ──────────────────────────────────────────────────
// Called by client after Firebase returns wrong-password / user-not-found.
// Semi-public: no auth required but IP is captured for audit.

exports.recordLoginFailure = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, reason } = req.body || {};

    if (!email || !isValidEmail(email)) {
      throw new AppError('A valid email address is required.', 400, 'INVALID_EMAIL');
    }

    const ip = (
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();

    const result = await recordFailedAttempt(email.trim().toLowerCase(), ip);

    // Write audit log (best-effort — don't let audit failure break the response)
    try {
      const { db } = getFirebaseAdmin();
      await writeAuditLog(db, {
        userId:    null,
        userEmail: email.trim().toLowerCase(),
        action:    AUDIT_ACTIONS.LOGIN_FAILED,
        collection: COLLECTIONS.USERS,
        documentId: null,
        details: `Failed login attempt. Reason: ${reason || 'unknown'}. IP: ${ip}. Attempts: ${result.attempts}.${result.locked ? ' ACCOUNT LOCKED.' : ''}`,
      });
    } catch (auditErr) {
      console.warn('[recordLoginFailure] Audit write failed:', auditErr.message);
    }

    return res.json({
      success:         true,
      attempts:        result.attempts,
      locked:          result.locked,
      lockedUntil:     result.lockedUntil || null,
      remainingMinutes: result.remainingMinutes || null,
      remaining:       result.remaining ?? null,
      warning:         result.warning || null,
      message:         result.message || null,
    });
  } catch (err) {
    return handleError(res, err, 'recordLoginFailure');
  }
});

// ── POST /recordLoginSuccess ──────────────────────────────────────────────────
// Called by client after a successful Firebase sign-in.
// Requires a valid Firebase ID token to prevent abuse.

exports.recordLoginSuccess = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) {
      throw new AppError(ctx.error || 'Unauthorized', ctx.status || 401, 'UNAUTHORIZED');
    }

    const email = ctx.user.email;
    if (!email) {
      throw new AppError('User record has no email address.', 400, 'NO_EMAIL');
    }

    await clearLoginAttempts(email.toLowerCase());

    const ip = (
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();

    try {
      const { db } = getFirebaseAdmin();
      await writeAuditLog(db, {
        userId:    ctx.user.uid,
        userEmail: email,
        userRole:  ctx.role,
        action:    AUDIT_ACTIONS.LOGIN,
        collection: COLLECTIONS.USERS,
        documentId: ctx.user.uid,
        details: `Successful login from IP: ${ip}`,
      });
    } catch (auditErr) {
      console.warn('[recordLoginSuccess] Audit write failed:', auditErr.message);
    }

    return res.json({ success: true });
  } catch (err) {
    return handleError(res, err, 'recordLoginSuccess');
  }
});
