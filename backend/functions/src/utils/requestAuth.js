const { getFirebaseAdmin } = require('../config/firebase');
const { normalizeRole, isAdminRole } = require('./auth');

function parseBearerToken(authorizationHeader) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = String(authorizationHeader).split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

async function authenticateRequest(req, { allowPublic = false, requireEmailVerified = false } = {}) {
  const token = parseBearerToken(req.get('authorization'));
  if (!token) {
    return allowPublic
      ? { ok: true, user: null, role: null }
      : { ok: false, status: 401, error: 'Missing bearer token', code: 'MISSING_TOKEN' };
  }

  try {
    const { auth } = getFirebaseAdmin();
    const decoded = await auth.verifyIdToken(token);
    const role = normalizeRole(decoded.role || decoded.customClaims?.role || decoded.claims?.role);

    if (requireEmailVerified && decoded.email_verified === false) {
      return {
        ok: false,
        status: 403,
        error: 'Email address must be verified before accessing this resource.',
        code: 'EMAIL_NOT_VERIFIED',
      };
    }

    return {
      ok: true,
      user: decoded,
      role,
      isAdmin: isAdminRole(role),
      isScanner: role === 'scanner_device',
    };
  } catch (error) {
    const code = error.code || '';
    if (code === 'auth/id-token-expired') {
      return { ok: false, status: 401, error: 'Session expired. Please sign in again.', code: 'TOKEN_EXPIRED' };
    }
    if (code === 'auth/id-token-revoked') {
      return { ok: false, status: 401, error: 'Session was revoked. Please sign in again.', code: 'TOKEN_REVOKED' };
    }
    return { ok: false, status: 401, error: 'Invalid or expired token', code: 'INVALID_TOKEN' };
  }
}

function requireRole(context, allowedRoles = []) {
  if (!context.ok) {
    return false;
  }

  if (!allowedRoles.length) {
    return true;
  }

  return allowedRoles.includes(context.role) || context.isAdmin;
}

module.exports = {
  authenticateRequest,
  requireRole,
};
