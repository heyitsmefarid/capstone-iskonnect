'use strict';

const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { getFirebaseAdmin } = require('../config/firebase');
const { authenticateRequest } = require('../utils/requestAuth');
const { AppError, handleError } = require('../utils/errors');
const { isValidEmail } = require('../utils/validation');
const { COLLECTIONS, AUDIT_ACTIONS } = require('../constants/collections');
const { writeAuditLog } = require('../utils/audit');

const OTP_TTL_MS          = 10 * 60 * 1000;   // 10 minutes
const OTP_MAX_ATTEMPTS    = 3;
const OTP_RATE_LIMIT      = 3;                 // max sends per hour per email
const OTP_RATE_WINDOW_MS  = 60 * 60 * 1000;   // 1 hour

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function generateOtp() {
  // Cryptographically secure 6-digit OTP
  const buf = crypto.randomBytes(4);
  const n = buf.readUInt32BE(0) % 1000000;
  return String(n).padStart(6, '0');
}

async function sendOtpEmail(email, otp) {
  const smtpConfigured =
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (!smtpConfigured) {
    // Dev mode — safe to log since this only runs in emulator/dev
    console.info(`[emailVerification] DEV OTP for ${email}: ${otp}`);
    return;
  }

  // Dynamic require so nodemailer stays optional in emulator-only deployments
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
    subject: 'ISKONNECT — Email Verification Code',
    text: `Your ISKONNECT verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#1B4D5C;margin-bottom:8px">Email Verification</h2>
        <p style="color:#555;margin-bottom:24px">Use the code below to verify your email address.</p>
        <div style="background:#f4f9fb;border:1px solid #c9e4ec;border-radius:8px;padding:20px 32px;text-align:center">
          <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1B4D5C">${otp}</span>
        </div>
        <p style="color:#888;font-size:13px;margin-top:16px">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
        <p style="color:#aaa;font-size:12px">ISKONNECT — Scholarship Management System</p>
      </div>`,
  });
}

// ── POST /sendEmailOTP ────────────────────────────────────────────────────────

exports.sendEmailOTP = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body || {};

    if (!email || !isValidEmail(email)) {
      throw new AppError('A valid email address is required.', 400, 'INVALID_EMAIL');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { db } = getFirebaseAdmin();
    const now = Date.now();

    // ── Rate limit: max 3 sends per email per hour ──────────────────────────
    const recentSnap = await db
      .collection(COLLECTIONS.EMAIL_OTPS)
      .where('email', '==', normalizedEmail)
      .where('createdAt', '>', new Date(now - OTP_RATE_WINDOW_MS).toISOString())
      .get();

    if (recentSnap.size >= OTP_RATE_LIMIT) {
      throw new AppError(
        'Too many verification codes requested. Please wait before requesting a new code.',
        429,
        'OTP_RATE_LIMITED',
      );
    }

    // ── Invalidate any existing unexpired OTPs for this email ───────────────
    const existingSnap = await db
      .collection(COLLECTIONS.EMAIL_OTPS)
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

    await db.collection(COLLECTIONS.EMAIL_OTPS).add({
      email:      normalizedEmail,
      otpHash:    hash,
      expiresAt:  expiry,
      createdAt:  new Date(now).toISOString(),
      attempts:   0,
      verified:   false,
      invalidated: false,
    });

    // ── Send email (or log in dev) ──────────────────────────────────────────
    await sendOtpEmail(normalizedEmail, otp);

    // Expose the code in the response for local testing — either when no SMTP is
    // configured, or whenever running inside the Functions emulator (so you don't
    // have to check an inbox). `FUNCTIONS_EMULATOR` is never set in deployed
    // production, so `devCode` is never exposed to real users.
    const smtpConfigured =
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
    const exposeCode = !smtpConfigured || process.env.FUNCTIONS_EMULATOR === 'true';

    return res.json({
      success: true,
      message: 'Verification code sent. Check your email.',
      expiresAt: expiry,
      ...(exposeCode ? { devCode: otp } : {}),
    });
  } catch (err) {
    return handleError(res, err, 'sendEmailOTP');
  }
});

// ── POST /verifyEmailOTP ──────────────────────────────────────────────────────

exports.verifyEmailOTP = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, otp } = req.body || {};

    if (!email || !isValidEmail(email)) {
      throw new AppError('A valid email address is required.', 400, 'INVALID_EMAIL');
    }
    if (!otp || typeof otp !== 'string' || otp.trim().length === 0) {
      throw new AppError('Verification code is required.', 400, 'MISSING_OTP');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { auth, db } = getFirebaseAdmin();
    const now = Date.now();

    // ── Find the latest valid OTP document for this email ──────────────────
    const snap = await db
      .collection(COLLECTIONS.EMAIL_OTPS)
      .where('email', '==', normalizedEmail)
      .where('verified', '==', false)
      .where('invalidated', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) {
      throw new AppError(
        'No active verification code found. Please request a new one.',
        400,
        'OTP_NOT_FOUND',
      );
    }

    const doc  = snap.docs[0];
    const data = doc.data();

    // ── Check expiry ────────────────────────────────────────────────────────
    if (new Date(data.expiresAt).getTime() < now) {
      await doc.ref.update({ invalidated: true });
      throw new AppError(
        'Verification code has expired. Please request a new one.',
        400,
        'OTP_EXPIRED',
      );
    }

    // ── Check attempt limit ─────────────────────────────────────────────────
    const attempts = (data.attempts || 0) + 1;
    if (attempts > OTP_MAX_ATTEMPTS) {
      await doc.ref.update({ invalidated: true, attempts });
      throw new AppError(
        'Too many incorrect attempts. Please request a new verification code.',
        400,
        'OTP_MAX_ATTEMPTS',
      );
    }

    // ── Verify hash ─────────────────────────────────────────────────────────
    const expectedHash = data.otpHash;
    const suppliedHash = hashOtp(otp.trim());

    if (!crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(suppliedHash, 'hex'))) {
      await doc.ref.update({ attempts });
      const remaining = OTP_MAX_ATTEMPTS - attempts;
      throw new AppError(
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
          : 'Too many incorrect attempts. Please request a new verification code.',
        400,
        'OTP_INVALID',
      );
    }

    // ── OTP is correct — mark email as verified ─────────────────────────────
    await doc.ref.update({ verified: true, verifiedAt: new Date(now).toISOString(), attempts });

    // Find the Firebase Auth user by email and mark emailVerified
    let uid = null;
    try {
      const userRecord = await auth.getUserByEmail(normalizedEmail);
      uid = userRecord.uid;
      await auth.updateUser(uid, { emailVerified: true });

      // Mirror to Firestore users doc if it exists
      const userDocRef = db.collection(COLLECTIONS.USERS).doc(uid);
      const userDocSnap = await userDocRef.get();
      if (userDocSnap.exists) {
        await userDocRef.update({
          emailVerified: true,
          emailVerifiedAt: new Date(now).toISOString(),
        });
      }

      await writeAuditLog(db, {
        userId:   uid,
        userEmail: normalizedEmail,
        action:   AUDIT_ACTIONS.EMAIL_VERIFIED,
        collection: COLLECTIONS.USERS,
        documentId: uid,
        details:  'Email address verified via OTP',
      });
    } catch (authErr) {
      // User may not exist in Auth yet (pre-registration flow) — that's fine
      console.warn('[verifyEmailOTP] Could not update Auth record:', authErr.message);
    }

    return res.json({
      success: true,
      message: 'Email address verified successfully.',
      emailVerified: true,
      uid,
    });
  } catch (err) {
    return handleError(res, err, 'verifyEmailOTP');
  }
});

// ── GET /emailVerificationStatus ──────────────────────────────────────────────

exports.emailVerificationStatus = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ctx = await authenticateRequest(req);
    if (!ctx.ok) {
      throw new AppError(ctx.error || 'Unauthorized', ctx.status || 401, 'UNAUTHORIZED');
    }

    const { auth } = getFirebaseAdmin();
    const userRecord = await auth.getUser(ctx.user.uid);

    return res.json({
      uid:           userRecord.uid,
      email:         userRecord.email,
      emailVerified: userRecord.emailVerified,
    });
  } catch (err) {
    return handleError(res, err, 'emailVerificationStatus');
  }
});
