'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { authenticateRequest, requireRole } = require('../utils/requestAuth');
const { AppError, handleError } = require('../utils/errors');
const { COLLECTIONS, ROLES, AUDIT_ACTIONS } = require('../constants/collections');
const { writeAuditLog } = require('../utils/audit');
const { validatePassword } = require('../utils/passwordValidation');
const {
  sanitizeObject,
  sanitizeString,
  isValidEmail,
  isValidUid,
  validateRequiredFields,
  validateEnum,
  collectErrors,
} = require('../utils/validation');

const ALLOWED_ROLES = [ROLES.ADMIN, ROLES.STAFF, ROLES.SCHOLAR, ROLES.APPLICANT];

// POST /createManagedUser
exports.createManagedUser = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) throw new AppError(ctx.error, ctx.status || 401, ctx.code);
    if (!requireRole(ctx, [ROLES.ADMIN, ROLES.SUPER_ADMIN])) {
      throw new AppError('Admin access required.', 403, 'FORBIDDEN');
    }

    const body = sanitizeObject(req.body || {});
    const missing = validateRequiredFields(body, ['email', 'password', 'role']);
    if (missing.length) {
      throw new AppError(`Missing required fields: ${missing.join(', ')}.`, 400, 'MISSING_FIELDS');
    }

    const { email, password, displayName, role, position } = body;

    if (!isValidEmail(email)) {
      throw new AppError('Invalid email address format.', 400, 'INVALID_EMAIL');
    }

    const roleError = validateEnum(role, ALLOWED_ROLES, 'role');
    if (roleError) throw new AppError(roleError, 400, 'INVALID_ROLE');

    const pwValidation = validatePassword(password);
    if (!pwValidation.valid) {
      return res.status(400).json({ error: 'Password does not meet requirements.', details: pwValidation.errors });
    }

    const { auth, db } = getFirebaseAdmin();

    const userRecord = await auth.createUser({
      email: email.trim().toLowerCase(),
      password,
      displayName: sanitizeString(displayName || email),
      emailVerified: false,
    });

    await auth.setCustomUserClaims(userRecord.uid, { role });

    const now = new Date().toISOString();
    await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set({
      email:       email.trim().toLowerCase(),
      displayName: sanitizeString(displayName || email),
      role,
      position:    sanitizeString(position || ''),
      status:      'active',
      emailVerified: false,
      createdAt:   now,
      createdBy:   ctx.user.uid,
    });

    await writeAuditLog(db, {
      userId:    ctx.user.uid,
      userEmail: ctx.user.email,
      userRole:  ctx.role,
      action:    AUDIT_ACTIONS.CREATE,
      collection: COLLECTIONS.USERS,
      documentId: userRecord.uid,
      details:   `User created with role: ${role}`,
    });

    return res.json({ success: true, uid: userRecord.uid });
  } catch (err) {
    return handleError(res, err, 'createManagedUser');
  }
});

// POST /resetUserPassword
exports.resetUserPassword = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) throw new AppError(ctx.error, ctx.status || 401, ctx.code);
    if (!requireRole(ctx, [ROLES.ADMIN, ROLES.SUPER_ADMIN])) {
      throw new AppError('Admin access required.', 403, 'FORBIDDEN');
    }

    const { targetUid, newPassword } = req.body || {};
    if (!targetUid || !newPassword) {
      throw new AppError('targetUid and newPassword are required.', 400, 'MISSING_FIELDS');
    }
    if (!isValidUid(targetUid)) {
      throw new AppError('Invalid user ID.', 400, 'INVALID_UID');
    }

    const pwValidation = validatePassword(newPassword);
    if (!pwValidation.valid) {
      return res.status(400).json({ error: 'Password does not meet requirements.', details: pwValidation.errors });
    }

    const { auth, db } = getFirebaseAdmin();
    await auth.updateUser(targetUid, { password: newPassword });

    await writeAuditLog(db, {
      userId:    ctx.user.uid,
      userEmail: ctx.user.email,
      userRole:  ctx.role,
      action:    AUDIT_ACTIONS.PASSWORD_RESET,
      collection: COLLECTIONS.USERS,
      documentId: targetUid,
      details:   'Password reset by admin',
    });

    return res.json({ success: true });
  } catch (err) {
    return handleError(res, err, 'resetUserPassword');
  }
});

// POST /updateUserRole
exports.updateUserRole = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) throw new AppError(ctx.error, ctx.status || 401, ctx.code);
    if (!requireRole(ctx, [ROLES.ADMIN, ROLES.SUPER_ADMIN])) {
      throw new AppError('Admin access required.', 403, 'FORBIDDEN');
    }

    const { targetUid, newRole } = req.body || {};
    if (!targetUid || !newRole) {
      throw new AppError('targetUid and newRole are required.', 400, 'MISSING_FIELDS');
    }
    if (!isValidUid(targetUid)) {
      throw new AppError('Invalid user ID.', 400, 'INVALID_UID');
    }

    const roleError = validateEnum(newRole, ALLOWED_ROLES, 'newRole');
    if (roleError) throw new AppError(roleError, 400, 'INVALID_ROLE');

    const { auth, db } = getFirebaseAdmin();
    await auth.setCustomUserClaims(targetUid, { role: newRole });
    await db.collection(COLLECTIONS.USERS).doc(targetUid).update({
      role:      newRole,
      updatedAt: new Date().toISOString(),
      updatedBy: ctx.user.uid,
    });

    await writeAuditLog(db, {
      userId:    ctx.user.uid,
      userEmail: ctx.user.email,
      userRole:  ctx.role,
      action:    AUDIT_ACTIONS.UPDATE,
      collection: COLLECTIONS.USERS,
      documentId: targetUid,
      details:   `Role changed to ${newRole}`,
    });

    return res.json({ success: true });
  } catch (err) {
    return handleError(res, err, 'updateUserRole');
  }
});

// POST /deactivateUser
exports.deactivateUser = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) throw new AppError(ctx.error, ctx.status || 401, ctx.code);
    if (!requireRole(ctx, [ROLES.ADMIN, ROLES.SUPER_ADMIN])) {
      throw new AppError('Admin access required.', 403, 'FORBIDDEN');
    }

    const { targetUid, disabled } = req.body || {};
    if (!targetUid) throw new AppError('targetUid is required.', 400, 'MISSING_FIELDS');
    if (!isValidUid(targetUid)) throw new AppError('Invalid user ID.', 400, 'INVALID_UID');

    const shouldDisable = disabled !== false;
    const { auth, db } = getFirebaseAdmin();
    await auth.updateUser(targetUid, { disabled: shouldDisable });
    await db.collection(COLLECTIONS.USERS).doc(targetUid).update({
      status:    shouldDisable ? 'inactive' : 'active',
      updatedAt: new Date().toISOString(),
      updatedBy: ctx.user.uid,
    });

    await writeAuditLog(db, {
      userId:    ctx.user.uid,
      userEmail: ctx.user.email,
      userRole:  ctx.role,
      action:    AUDIT_ACTIONS.UPDATE,
      collection: COLLECTIONS.USERS,
      documentId: targetUid,
      details:   `Account ${shouldDisable ? 'deactivated' : 'reactivated'}`,
    });

    return res.json({ success: true });
  } catch (err) {
    return handleError(res, err, 'deactivateUser');
  }
});

// GET /getAuditLogs
exports.getAuditLogs = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) throw new AppError(ctx.error, ctx.status || 401, ctx.code);
    if (!requireRole(ctx, [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.STAFF])) {
      throw new AppError('Forbidden.', 403, 'FORBIDDEN');
    }

    const { db } = getFirebaseAdmin();
    const { limit = '100', action, userId, collection } = req.query || {};

    const parsedLimit = Math.min(Math.max(1, Number(limit) || 100), 500);

    let query = db
      .collection(COLLECTIONS.AUDIT_LOGS)
      .orderBy('timestamp', 'desc')
      .limit(parsedLimit);

    if (action)     query = query.where('action', '==', sanitizeString(action));
    if (userId)     query = query.where('userId', '==', sanitizeString(userId));
    if (collection) query = query.where('collection', '==', sanitizeString(collection));

    const snap = await query.get();
    const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return res.json({ logs, total: logs.length });
  } catch (err) {
    return handleError(res, err, 'getAuditLogs');
  }
});
