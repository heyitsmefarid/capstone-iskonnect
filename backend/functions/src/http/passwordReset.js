'use strict';

// Password reset via emailed OTP, delivered over SMTP (nodemailer).
//
// Flow:
//   1) POST /requestPasswordResetOTP { email }
//        → if an account exists, emails a 6-digit code (stored hashed).
//          Always returns a generic success so the endpoint cannot be used to
//          enumerate which emails have accounts.
//   2) POST /resetPasswordWithOTP { email, otp, newPassword }
//        → verifies the code and sets the new password via the Admin SDK.

const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { AppError, handleError } = require('../utils/errors');
const { isValidEmail } = require('../utils/validation');
const { COLLECTIONS, AUDIT_ACTIONS } = require('../constants/collections');
const { writeAuditLog } = require('../utils/audit');

const OTP_TTL_MS         = 10 * 60 * 1000;  // 10 minutes
const OTP_MAX_ATTEMPTS   = 3;
const OTP_RATE_LIMIT     = 3;               // max sends per email per hour
const OTP_RATE_WINDOW_MS = 60 * 60 * 1000;  // 1 hour

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function generateOtp() {
  const buf = crypto.randomBytes(4);
  const n = buf.readUInt32BE(0) % 1000000;
  return String(n).padStart(6, '0');
}

// Mirror of the client-side rule so the server is the source of truth: at least
// 8 chars with an uppercase, lowercase, number and special character.
function isStrongPassword(pw) {
  return (
    typeof pw === 'string' &&
    pw.length >= 8 &&
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}

async function sendResetEmail(email, otp) {
  const smtpConfigured =
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (!smtpConfigured) {
    // Dev mode — safe to log since this only runs in emulator/dev.
    console.info(`[passwordReset] DEV reset OTP for ${email}: ${otp}`);
    return;
  }

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'ISKONNECT — Password Reset Code',
    text: `Your ISKONNECT password reset code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request a password reset, you can safely ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1B4D5C;margin-bottom:8px">Password Reset</h2>
        <p style="color:#555;margin-bottom:24px">Use the code below to reset your ISKONNECT password.</p>
        <div style="background:#f4f9fb;border:1px solid #c9e4ec;border-radius:8px;padding:20px 32px;text-align:center">
          <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1B4D5C">${otp}</span>
        </div>
        <p style="color:#888;font-size:13px;margin-top:16px">This code expires in <strong>10 minutes</strong>. If you did not request a reset, ignore this email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="color:#aaa;font-size:12px">ISKONNECT — Scholarship Management System</p>
      </div>`,
  });
}

// ── POST /requestPasswordResetOTP ──────────────────────────────────────────────

exports.requestPasswordResetOTP = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body || {};

    if (!email || !isValidEmail(email)) {
      throw new AppError('A valid email address is required.', 400, 'INVALID_EMAIL');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { auth, db } = getFirebaseAdmin();
    const now = Date.now();

    // Generic success response used in every "no real send" branch so callers
    // cannot tell whether the email has an account.
    const genericOk = {
      success: true,
      message: 'If an account exists for that email, a reset code has been sent.',
    };

    // Only proceed if a Firebase Auth account actually exists for this email.
    let userExists = true;
    try {
      await auth.getUserByEmail(normalizedEmail);
    } catch (_) {
      userExists = false;
    }
    if (!userExists) {
      return res.json(genericOk);
    }

    // ── Rate limit: max sends per email per hour ────────────────────────────
    const recentSnap = await db
      .collection(COLLECTIONS.PASSWORD_RESET_OTPS)
      .where('email', '==', normalizedEmail)
      .where('createdAt', '>', new Date(now - OTP_RATE_WINDOW_MS).toISOString())
      .get();

    if (recentSnap.size >= OTP_RATE_LIMIT) {
      throw new AppError(
        'Too many reset codes requested. Please wait before requesting a new code.',
        429,
        'OTP_RATE_LIMITED',
      );
    }

    // ── Invalidate any existing unused reset OTPs for this email ────────────
    const existingSnap = await db
      .collection(COLLECTIONS.PASSWORD_RESET_OTPS)
      .where('email', '==', normalizedEmail)
      .where('invalidated', '==', false)
      .where('verified', '==', false)
      .get();

    const batch = db.batch();
    existingSnap.docs.forEach((d) => batch.update(d.ref, { invalidated: true }));
    await batch.commit();

    // ── Generate and store new OTP ──────────────────────────────────────────
    const otp    = generateOtp();
    const hash   = hashOtp(otp);
    const expiry = new Date(now + OTP_TTL_MS).toISOString();

    await db.collection(COLLECTIONS.PASSWORD_RESET_OTPS).add({
      email:       normalizedEmail,
      otpHash:     hash,
      expiresAt:   expiry,
      createdAt:   new Date(now).toISOString(),
      attempts:    0,
      verified:    false,
      invalidated: false,
    });

    await sendResetEmail(normalizedEmail, otp);

    return res.json(genericOk);
  } catch (err) {
    return handleError(res, err, 'requestPasswordResetOTP');
  }
});

// ── POST /resetPasswordWithOTP ─────────────────────────────────────────────────

exports.resetPasswordWithOTP = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, otp, newPassword } = req.body || {};

    if (!email || !isValidEmail(email)) {
      throw new AppError('A valid email address is required.', 400, 'INVALID_EMAIL');
    }
    if (!otp || typeof otp !== 'string' || otp.trim().length === 0) {
      throw new AppError('Reset code is required.', 400, 'MISSING_OTP');
    }
    if (!isStrongPassword(newPassword)) {
      throw new AppError(
        'Password must be at least 8 characters and include uppercase, lowercase, a number and a special character.',
        400,
        'WEAK_PASSWORD',
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { auth, db } = getFirebaseAdmin();
    const now = Date.now();

    // ── Find the latest valid reset OTP for this email ──────────────────────
    const snap = await db
      .collection(COLLECTIONS.PASSWORD_RESET_OTPS)
      .where('email', '==', normalizedEmail)
      .where('verified', '==', false)
      .where('invalidated', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) {
      throw new AppError(
        'No active reset code found. Please request a new one.',
        400,
        'OTP_NOT_FOUND',
      );
    }

    const doc  = snap.docs[0];
    const data = doc.data();

    // ── Expiry ──────────────────────────────────────────────────────────────
    if (new Date(data.expiresAt).getTime() < now) {
      await doc.ref.update({ invalidated: true });
      throw new AppError('Reset code has expired. Please request a new one.', 400, 'OTP_EXPIRED');
    }

    // ── Attempt limit ────────────────────────────────────────────────────────
    const attempts = (data.attempts || 0) + 1;
    if (attempts > OTP_MAX_ATTEMPTS) {
      await doc.ref.update({ invalidated: true, attempts });
      throw new AppError(
        'Too many incorrect attempts. Please request a new reset code.',
        400,
        'OTP_MAX_ATTEMPTS',
      );
    }

    // ── Verify hash (constant time) ──────────────────────────────────────────
    const expectedHash = data.otpHash;
    const suppliedHash = hashOtp(otp.trim());

    if (!crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(suppliedHash, 'hex'))) {
      await doc.ref.update({ attempts });
      const remaining = OTP_MAX_ATTEMPTS - attempts;
      throw new AppError(
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
          : 'Too many incorrect attempts. Please request a new reset code.',
        400,
        'OTP_INVALID',
      );
    }

    // ── Code is correct — update the account password ───────────────────────
    const userRecord = await auth.getUserByEmail(normalizedEmail);
    await auth.updateUser(userRecord.uid, { password: newPassword });

    await doc.ref.update({ verified: true, verifiedAt: new Date(now).toISOString(), attempts });

    await writeAuditLog(db, {
      userId:     userRecord.uid,
      userEmail:  normalizedEmail,
      action:     AUDIT_ACTIONS.PASSWORD_RESET,
      collection: COLLECTIONS.USERS,
      documentId: userRecord.uid,
      details:    'Password reset via emailed OTP',
    });

    return res.json({
      success: true,
      message: 'Your password has been reset. You can now sign in with your new password.',
    });
  } catch (err) {
    return handleError(res, err, 'resetPasswordWithOTP');
  }
});
