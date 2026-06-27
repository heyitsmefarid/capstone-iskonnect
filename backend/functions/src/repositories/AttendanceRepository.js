const BaseRepository = require('./BaseRepository');
const { COLLECTIONS } = require('../constants/collections');

/**
 * AttendanceRepository handles attendance logs and events
 * Specializes in duplicate detection, batch operations, and queries
 */
class AttendanceRepository extends BaseRepository {
  constructor() {
    super(COLLECTIONS.ATTENDANCE_LOGS);
    this.eventsCollection = COLLECTIONS.ATTENDANCE_EVENTS;
  }

  /**
   * Get Firebase admin instances
   */
  getAdmin() {
    const { getFirebaseAdmin } = require('../config/firebase');
    return getFirebaseAdmin();
  }

  /**
   * Build unique document ID for attendance
   * @param {string} eventId - Event ID
   * @param {string} scholarId - Scholar ID
   * @param {string} attendedAt - Attendance date
   * @returns {string}
   */
  buildDocId(eventId, scholarId, attendedAt) {
    const dateKey = new Date(attendedAt).toISOString().slice(0, 10);
    return `${eventId}_${scholarId}_${dateKey}`;
  }

  /**
   * Check if attendance record already exists
   * @param {string} eventId - Event ID
   * @param {string} scholarId - Scholar ID
   * @param {string} attendedAt - Attendance date
   * @returns {Promise<boolean>}
   */
  async isDuplicate(eventId, scholarId, attendedAt) {
    const docId = this.buildDocId(eventId, scholarId, attendedAt);
    return this.exists(docId);
  }

  /**
   * Create attendance record with duplicate detection
   * @param {object} record - Attendance record
   * @returns {Promise<{created: boolean, docId: string}>}
   */
  async createWithDuplicateDetection(record) {
    const { scholarId, eventId, attendedAt, scannerDeviceId, ...otherData } = record;
    const docId = this.buildDocId(eventId, scholarId, attendedAt);

    const isDuplicate = await this.exists(docId);
    if (isDuplicate) {
      return { created: false, docId, reason: 'duplicate' };
    }

    const { fieldValue } = this.getAdmin();
    const attendanceData = {
      eventId,
      scholarId: String(scholarId),
      attendedAt,
      scannerDeviceId,
      markedVia: 'qr_scanner',
      source: 'offline_sync',
      ...otherData,
      createdAt: fieldValue.serverTimestamp(),
    };

    await this.db.collection(this.collectionName).doc(docId).set(attendanceData);
    return { created: true, docId };
  }

  /**
   * Batch ingest attendance records
   * @param {Array<object>} records - Array of attendance records
   * @param {object} options - { eventId, scannerDeviceId }
   * @returns {Promise<{inserted: number, skipped: number, duplicates: Array}>}
   */
  async batchIngest(records, options = {}) {
    const { fieldValue } = this.getAdmin();
    const batch = this.db.batch();
    let insertedCount = 0;
    let skippedCount = 0;
    const duplicates = [];

    for (const record of records) {
      const scholarId = record.scholarId || record.studentId;
      const attendedAt = record.attendedAt || record.timestamp || new Date().toISOString();

      if (!scholarId) {
        skippedCount += 1;
        continue;
      }

      const docId = this.buildDocId(options.eventId, scholarId, attendedAt);
      const docRef = this.db.collection(this.collectionName).doc(docId);
      const docSnapshot = await docRef.get();

      if (docSnapshot.exists) {
        skippedCount += 1;
        duplicates.push(docId);
        continue;
      }

      const payload = {
        ...record,
        eventId: options.eventId,
        scholarId: String(scholarId),
        attendedAt,
        scannerDeviceId: options.scannerDeviceId,
        markedVia: 'qr_scanner',
        source: 'offline_sync',
        createdAt: fieldValue.serverTimestamp(),
      };

      batch.set(docRef, payload, { merge: true });
      insertedCount += 1;
    }

    await batch.commit();
    return { insertedCount, skippedCount, duplicates };
  }

  /**
   * Get attendance records for a scholar within date range
   * @param {string} scholarId - Scholar ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array<object>>}
   */
  async getScholarAttendance(scholarId, startDate, endDate) {
    return this.query(
      [
        ['scholarId', '==', scholarId],
        ['attendedAt', '>=', startDate.toISOString()],
        ['attendedAt', '<=', endDate.toISOString()],
      ],
      { orderBy: { field: 'attendedAt', direction: 'desc' } }
    );
  }

  /**
   * Get attendance records for an event
   * @param {string} eventId - Event ID
   * @returns {Promise<Array<object>>}
   */
  async getEventAttendance(eventId) {
    return this.query(
      [['eventId', '==', eventId]],
      { orderBy: { field: 'attendedAt', direction: 'desc' } }
    );
  }
}

module.exports = AttendanceRepository;
