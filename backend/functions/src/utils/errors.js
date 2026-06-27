'use strict';

/**
 * AppError — known, intentional errors safe to expose to the client.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Map Firebase Auth / Firestore gRPC error codes to HTTP status + user-safe message.
 */
const FIREBASE_AUTH_ERROR_MAP = {
  'auth/email-already-exists':    { status: 409, message: 'Email address is already registered.' },
  'auth/email-already-in-use':    { status: 409, message: 'Email address is already in use.' },
  'auth/invalid-email':           { status: 400, message: 'Invalid email address format.' },
  'auth/user-not-found':          { status: 404, message: 'No account found with that email.' },
  'auth/wrong-password':          { status: 401, message: 'Incorrect password.' },
  'auth/too-many-requests':       { status: 429, message: 'Too many requests. Please try again later.' },
  'auth/user-disabled':           { status: 403, message: 'This account has been disabled. Contact support.' },
  'auth/id-token-expired':        { status: 401, message: 'Session expired. Please sign in again.' },
  'auth/id-token-revoked':        { status: 401, message: 'Session was revoked. Please sign in again.' },
  'auth/invalid-id-token':        { status: 401, message: 'Invalid authentication token.' },
  'auth/uid-already-exists':      { status: 409, message: 'A user with this ID already exists.' },
  'auth/insufficient-permission': { status: 403, message: 'Insufficient permissions.' },
  'auth/invalid-argument':        { status: 400, message: 'Invalid argument provided to authentication service.' },
  'auth/invalid-credential':      { status: 401, message: 'Invalid credentials. Please sign in again.' },
  'auth/session-cookie-expired':  { status: 401, message: 'Session cookie has expired.' },
  'auth/quota-exceeded':          { status: 429, message: 'Service quota exceeded. Try again later.' },
  'auth/operation-not-allowed':   { status: 403, message: 'This operation is not allowed.' },
  'auth/weak-password':           { status: 400, message: 'Password is too weak.' },
};

// Firestore gRPC status codes
const FIRESTORE_ERROR_MAP = {
  5:  { status: 404, message: 'Resource not found.' },
  6:  { status: 409, message: 'Resource already exists.' },
  7:  { status: 403, message: 'Permission denied.' },
  8:  { status: 429, message: 'Resource exhausted. Try again later.' },
  9:  { status: 400, message: 'Invalid request.' },
  13: { status: 500, message: 'Internal server error.' },
  14: { status: 503, message: 'Service temporarily unavailable.' },
};

function mapFirebaseError(err) {
  if (err.code && FIREBASE_AUTH_ERROR_MAP[err.code]) {
    const m = FIREBASE_AUTH_ERROR_MAP[err.code];
    return { status: m.status, message: m.message, code: err.code };
  }
  if (typeof err.code === 'number' && FIRESTORE_ERROR_MAP[err.code]) {
    const m = FIRESTORE_ERROR_MAP[err.code];
    return { status: m.status, message: m.message, code: `firestore/${err.code}` };
  }
  return null;
}

/**
 * handleError — unified error response writer.
 * Always returns a JSON response; never leaks stack traces in production.
 *
 * @param {import('express').Response} res
 * @param {Error} err
 * @param {string} [context] - function name label for server-side logs
 */
function handleError(res, err, context = '') {
  const label = context ? `[${context}]` : '[backend]';

  // 1. Known AppErrors — user-safe message, custom status
  if (err instanceof AppError) {
    console.warn(`${label} AppError (${err.statusCode}):`, err.message);
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    });
  }

  // 2. Firebase-specific errors — map to safe message + status
  const mapped = mapFirebaseError(err);
  if (mapped) {
    console.warn(`${label} Firebase error [${err.code}]:`, err.message);
    return res.status(mapped.status).json({
      error: mapped.message,
      code: mapped.code,
    });
  }

  // 3. Unexpected errors — log full trace, never expose internals
  console.error(`${label} Unexpected error:`, err);
  return res.status(500).json({
    error: 'An unexpected error occurred. Please try again or contact support.',
  });
}

module.exports = { AppError, handleError };
