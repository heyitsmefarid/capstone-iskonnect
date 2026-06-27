'use strict';

/**
 * Login rate limiting using Firestore as the shared store.
 *
 * Policy:
 *   - Max 5 failed attempts within a 15-minute sliding window.
 *   - On the 5th failure the account is locked for 30 minutes.
 *   - A successful login clears all failed attempts.
 *   - IP addresses are recorded (up to 10 unique) for audit purposes.
 */

const { getFirebaseAdmin } = require('../config/firebase');
const { COLLECTIONS } = require('../constants/collections');

const MAX_ATTEMPTS      = 5;
const WINDOW_MS         = 15 * 60 * 1000;  // 15 minutes
const LOCK_DURATION_MS  = 30 * 60 * 1000;  // 30 minutes

/** Converts an email into a Firestore-safe document ID. */
function toDocId(email) {
  return email.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/**
 * Check whether an email is currently locked out.
 *
 * @returns {{ locked: boolean, remaining?: number, lockedUntil?: string,
 *             remainingMinutes?: number, message?: string }}
 */
async function checkLoginLock(email) {
  const { db } = getFirebaseAdmin();
  const ref  = db.collection(COLLECTIONS.LOGIN_ATTEMPTS).doc(toDocId(email));
  const snap = await ref.get();

  if (!snap.exists) return { locked: false, remaining: MAX_ATTEMPTS };

  const data = snap.data();
  const now  = Date.now();

  // ── Locked path ──────────────────────────────────────────────────────────
  if (data.lockedUntil) {
    const lockedUntilMs = _toMs(data.lockedUntil);
    if (now < lockedUntilMs) {
      const remainingMinutes = Math.ceil((lockedUntilMs - now) / 60000);
      return {
        locked: true,
        lockedUntil: new Date(lockedUntilMs).toISOString(),
        remainingMinutes,
        message: `Account temporarily locked. Try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
      };
    }
    // Lock expired → clean up
    await ref.delete();
    return { locked: false, remaining: MAX_ATTEMPTS };
  }

  // ── Window check ─────────────────────────────────────────────────────────
  const firstAttemptMs = _toMs(data.firstAttemptAt);
  if (now - firstAttemptMs > WINDOW_MS) {
    await ref.delete();
    return { locked: false, remaining: MAX_ATTEMPTS };
  }

  const attempts  = data.attempts || 0;
  const remaining = Math.max(0, MAX_ATTEMPTS - attempts);
  return { locked: false, remaining, attempts };
}

/**
 * Record a failed login attempt.
 *
 * @returns {{ attempts: number, locked: boolean, remaining?: number,
 *             lockedUntil?: string, remainingMinutes?: number,
 *             warning?: string, message?: string }}
 */
async function recordFailedAttempt(email, ipAddress = null) {
  const { db } = getFirebaseAdmin();
  const ref  = db.collection(COLLECTIONS.LOGIN_ATTEMPTS).doc(toDocId(email));
  const snap = await ref.get();
  const now  = Date.now();

  // First ever attempt or record was cleared
  if (!snap.exists) {
    await ref.set(_newRecord(email, ipAddress, now));
    return { attempts: 1, locked: false, remaining: MAX_ATTEMPTS - 1 };
  }

  const data           = snap.data();
  const firstAttemptMs = _toMs(data.firstAttemptAt);

  // Window has expired → treat as fresh start
  if (now - firstAttemptMs > WINDOW_MS) {
    await ref.set(_newRecord(email, ipAddress, now));
    return { attempts: 1, locked: false, remaining: MAX_ATTEMPTS - 1 };
  }

  const newAttempts = (data.attempts || 0) + 1;
  const ips = _mergeIP(data.ipAddresses, ipAddress);

  const update = {
    attempts:      newAttempts,
    lastAttemptAt: new Date(now).toISOString(),
    ipAddresses:   ips,
  };

  if (newAttempts >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(now + LOCK_DURATION_MS).toISOString();
    update.lockedUntil = lockedUntil;
    update.lockedAt    = new Date(now).toISOString();
    await ref.update(update);
    return {
      attempts: newAttempts,
      locked: true,
      lockedUntil,
      remainingMinutes: LOCK_DURATION_MS / 60000,
      message: `Too many failed attempts. Account locked for ${LOCK_DURATION_MS / 60000} minutes.`,
    };
  }

  await ref.update(update);
  const remaining = MAX_ATTEMPTS - newAttempts;
  return {
    attempts: newAttempts,
    locked: false,
    remaining,
    warning: remaining <= 2
      ? `Warning: ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before your account is locked.`
      : null,
  };
}

/**
 * Clear all failed attempts after a successful login.
 */
async function clearLoginAttempts(email) {
  const { db } = getFirebaseAdmin();
  await db.collection(COLLECTIONS.LOGIN_ATTEMPTS).doc(toDocId(email)).delete();
}

// ── Helpers ───────────────────────────────────────────────────────────────

function _toMs(value) {
  if (!value) return 0;
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  return new Date(value).getTime();
}

function _newRecord(email, ipAddress, nowMs) {
  return {
    email:          email.toLowerCase(),
    attempts:       1,
    firstAttemptAt: new Date(nowMs).toISOString(),
    lastAttemptAt:  new Date(nowMs).toISOString(),
    lockedUntil:    null,
    lockedAt:       null,
    ipAddresses:    ipAddress ? [ipAddress] : [],
  };
}

function _mergeIP(existing, newIp) {
  if (!newIp) return existing || [];
  return Array.from(new Set([...(existing || []), newIp])).slice(-10);
}

module.exports = {
  checkLoginLock,
  recordFailedAttempt,
  clearLoginAttempts,
  MAX_ATTEMPTS,
  LOCK_DURATION_MS,
  WINDOW_MS,
};
