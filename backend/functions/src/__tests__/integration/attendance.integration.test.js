/**
 * Integration tests for attendance operations
 * Tests offline sync, duplicate detection, and Firestore operations
 */

const { RepositoryFactory } = require('../../../repositories');
const { COLLECTIONS } = require('../../../constants/collections');
const QRPayload = require('../../../utils/qrPayload');

describe('Attendance Integration Tests', () => {
  let attendanceRepo;

  beforeEach(() => {
    attendanceRepo = RepositoryFactory.getAttendanceRepository();
  });

  describe('Attendance Batch Ingestion', () => {
    it('should successfully ingest valid attendance records', async () => {
      const records = [
        {
          scholarId: 'scholar_1',
          attendedAt: new Date().toISOString(),
        },
        {
          scholarId: 'scholar_2',
          attendedAt: new Date().toISOString(),
        },
      ];

      const result = await attendanceRepo.batchIngest(records, {
        eventId: 'event_1',
        scannerDeviceId: 'device_1',
      });

      expect(result.insertedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.duplicates).toHaveLength(0);
    });

    it('should skip invalid records without scholarId', async () => {
      const records = [
        {
          attendance: 'invalid',
        },
        {
          scholarId: 'scholar_2',
          attendedAt: new Date().toISOString(),
        },
      ];

      const result = await attendanceRepo.batchIngest(records, {
        eventId: 'event_1',
        scannerDeviceId: 'device_1',
      });

      expect(result.insertedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });

    it('should detect and skip duplicate records', async () => {
      const attendedAt = new Date().toISOString();
      const docId = 'event_1_scholar_1_2024-01-15';

      // Pre-create duplicate
      await attendanceRepo.db
        .collection(COLLECTIONS.ATTENDANCE_LOGS)
        .doc(docId)
        .set({ markers: 'existing' });

      const records = [
        {
          scholarId: 'scholar_1',
          attendedAt,
        },
      ];

      const result = await attendanceRepo.batchIngest(records, {
        eventId: 'event_1',
        scannerDeviceId: 'device_1',
      });

      expect(result.insertedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.duplicates).toContain(docId);
    });
  });

  describe('Duplicate Detection', () => {
    it('should correctly identify duplicate attendance', async () => {
      const eventId = 'event_dup_test';
      const scholarId = 'scholar_dup_test';
      const attendedAt = new Date().toISOString();

      // First record
      const result1 = await attendanceRepo.createWithDuplicateDetection({
        eventId,
        scholarId,
        attendedAt,
        scannerDeviceId: 'device_1',
      });

      expect(result1.created).toBe(true);

      // Duplicate attempt
      const result2 = await attendanceRepo.createWithDuplicateDetection({
        eventId,
        scholarId,
        attendedAt,
        scannerDeviceId: 'device_1',
      });

      expect(result2.created).toBe(false);
      expect(result2.reason).toBe('duplicate');
      expect(result2.docId).toBe(result1.docId);
    });
  });

  describe('Attendance Queries', () => {
    it('should retrieve scholar attendance records', async () => {
      const scholarId = 'scholar_query_test';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Create test records
      await attendanceRepo.create('event_1_scholar_query_test_2024-01-15', {
        eventId: 'event_1',
        scholarId,
        attendedAt: '2024-01-15T10:00:00Z',
      });

      const records = await attendanceRepo.getScholarAttendance(
        scholarId,
        startDate,
        endDate
      );

      expect(Array.isArray(records)).toBe(true);
      expect(records.some(r => r.scholarId === scholarId)).toBe(true);
    });

    it('should retrieve event attendance records', async () => {
      const eventId = 'event_query_test';

      const records = await attendanceRepo.getEventAttendance(eventId);

      expect(Array.isArray(records)).toBe(true);
    });
  });
});

describe('QR Payload Validation', () => {
  const signingSecret = 'test_secret_key';

  it('should validate correct QR payload', () => {
    const payload = {
      schemaVersion: '1.0',
      eventId: 'event_1',
      scholarId: 'scholar_1',
      timestamp: new Date().toISOString(),
      data: { type: 'attendance' },
    };

    payload.signature = QRPayload.generateSignature(payload, signingSecret);

    const validation = QRPayload.validate(payload, signingSecret);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should reject payload with invalid signature', () => {
    const payload = {
      schemaVersion: '1.0',
      eventId: 'event_1',
      scholarId: 'scholar_1',
      timestamp: new Date().toISOString(),
      signature: 'invalid_signature_1234567890abcdef',
      data: { type: 'attendance' },
    };

    const validation = QRPayload.validate(payload, signingSecret);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('Signature'))).toBe(true);
  });

  it('should reject expired payload', () => {
    const oldDate = new Date();
    oldDate.setSeconds(oldDate.getSeconds() - 600); // 10 minutes ago

    const payload = {
      schemaVersion: '1.0',
      eventId: 'event_1',
      scholarId: 'scholar_1',
      timestamp: oldDate.toISOString(),
      data: { type: 'attendance' },
    };

    payload.signature = QRPayload.generateSignature(payload, signingSecret);

    const validation = QRPayload.validate(payload, signingSecret, {
      maxTimestampAgeSec: 300,
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('old'))).toBe(true);
  });

  it('should validate structure', () => {
    const validation = QRPayload.validateStructure({
      missingFields: true,
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});

describe('User and Profile Operations', () => {
  let userRepo;

  beforeEach(() => {
    userRepo = RepositoryFactory.getUserRepository();
  });

  it('should create user with profile', async () => {
    const userId = `test_user_${Date.now()}`;
    const userData = {
      email: `test_${Date.now()}@example.com`,
      role: 'scholar',
      status: 'active',
    };
    const profileData = {
      firstName: 'Test',
      lastName: 'User',
      department: 'Engineering',
    };

    await userRepo.createWithProfile(userId, userData, profileData);

    const user = await userRepo.read(userId);
    expect(user).not.toBeNull();
    expect(user.email).toBe(userData.email);
  });

  it('should deactivate user', async () => {
    const userId = `test_deactivate_${Date.now()}`;
    await userRepo.create(userId, {
      email: `test_${Date.now()}@example.com`,
      role: 'scholar',
      status: 'active',
    });

    await userRepo.deactivate(userId);

    const user = await userRepo.read(userId);
    expect(user.status).toBe('inactive');
  });

  it('should activate user', async () => {
    const userId = `test_activate_${Date.now()}`;
    await userRepo.create(userId, {
      email: `test_${Date.now()}@example.com`,
      role: 'scholar',
      status: 'inactive',
    });

    await userRepo.activate(userId);

    const user = await userRepo.read(userId);
    expect(user.status).toBe('active');
  });
});

describe('Repository Error Handling', () => {
  let attendanceRepo;

  beforeEach(() => {
    attendanceRepo = RepositoryFactory.getAttendanceRepository();
  });

  it('should handle missing document gracefully', async () => {
    const result = await attendanceRepo.read('nonexistent_document');
    expect(result).toBeNull();
  });

  it('should handle batch operations error', async () => {
    const records = [
      {
        scholarId: null, // Invalid
      },
    ];

    const result = await attendanceRepo.batchIngest(records, {
      eventId: 'event_1',
      scannerDeviceId: 'device_1',
    });

    expect(result.insertedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
  });
});
