const { onRequest } = require('firebase-functions/v2/https');
const { COLLECTIONS } = require('../constants/collections');
const { authenticateRequest, requireRole } = require('../utils/requestAuth');
const { writeAuditLog } = require('../utils/audit');
const { RepositoryFactory } = require('../repositories');
const QRPayload = require('../utils/qrPayload');
const FirebaseEnvironmentValidator = require('../utils/firebaseEnvironmentValidator');

function allowUnsignedRecords() {
  const env = FirebaseEnvironmentValidator.detectEnvironment();
  return env === FirebaseEnvironmentValidator.ENVIRONMENTS.DEVELOPMENT ||
    env === FirebaseEnvironmentValidator.ENVIRONMENTS.EMULATOR;
}

async function validateOfflineRecord(record, secret) {
  const payload = record?.qrPayload;
  if (!payload) {
    return {
      valid: allowUnsignedRecords(),
      reason: 'missing_qr_payload',
      warning: 'Record has no qrPayload; accepted only in development/emulator',
    };
  }

  const validation = await QRPayload.validate(payload, secret, {
    maxTimestampAgeSec: 60 * 60 * 24,
  });

  if (!validation.valid) {
    return {
      valid: false,
      reason: validation.errors.join('; '),
    };
  }

  if (payload.eventId && record.eventId && payload.eventId !== record.eventId) {
    return {
      valid: false,
      reason: 'eventId mismatch between record and qrPayload',
    };
  }

  if (payload.scholarId && (record.scholarId || record.studentId) && payload.scholarId !== String(record.scholarId || record.studentId)) {
    return {
      valid: false,
      reason: 'scholarId mismatch between record and qrPayload',
    };
  }

  return { valid: true };
}

const ingestOfflineAttendance = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authContext = await authenticateRequest(req);
  if (!authContext.ok) {
    return res.status(authContext.status).json({ error: authContext.error });
  }

  if (!requireRole(authContext, ['scanner_device', 'admin', 'super_admin'])) {
    return res.status(403).json({ error: 'Insufficient role' });
  }

  const body = req.body || {};
  const records = Array.isArray(body.records) ? body.records : [];
  const eventId = body.eventId || null;
  const scannerDeviceId = body.scannerDeviceId || req.get('x-scanner-device-id') || null;
  const qrSigningSecret = process.env.QR_SIGNING_SECRET || 'dev-qr-secret';

  if (!eventId || !scannerDeviceId) {
    return res.status(400).json({
      error: 'eventId and scannerDeviceId are required',
    });
  }

  try {
    const validatedRecords = [];
    const rejectedRecords = [];

    for (const record of records) {
      const check = await validateOfflineRecord(record, qrSigningSecret);
      if (!check.valid) {
        rejectedRecords.push({
          scholarId: record?.scholarId || record?.studentId || null,
          reason: check.reason,
        });
        continue;
      }

      validatedRecords.push(record);
    }

    const attendanceRepo = RepositoryFactory.getAttendanceRepository();
    const result = await attendanceRepo.batchIngest(validatedRecords, {
      eventId,
      scannerDeviceId,
    });

    await writeAuditLog({
      action: 'offline_attendance_sync',
      actorId: authContext.user.uid,
      actorRole: authContext.role,
      targetType: COLLECTIONS.ATTENDANCE_LOGS,
      targetId: eventId,
      details: {
        insertedCount: result.insertedCount,
        skippedCount: result.skippedCount,
        duplicatesCount: result.duplicates.length,
        rejectedCount: rejectedRecords.length,
        scannerDeviceId,
      },
    });

    return res.status(200).json({
      ok: true,
      insertedCount: result.insertedCount,
      skippedCount: result.skippedCount,
      duplicates: result.duplicates,
      rejectedRecords,
    });
  } catch (error) {
    console.error('Error ingesting offline attendance:', error);
    return res.status(500).json({
      error: 'Failed to ingest attendance records',
      details: error.message,
    });
  }
});

module.exports = {
  ingestOfflineAttendance,
};
