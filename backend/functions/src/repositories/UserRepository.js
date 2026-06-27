const BaseRepository = require('./BaseRepository');
const { COLLECTIONS } = require('../constants/collections');

/**
 * UserRepository handles user accounts and authentication data
 */
class UserRepository extends BaseRepository {
  constructor() {
    super(COLLECTIONS.USERS);
  }

  /**
   * Get user by email
   * @param {string} email - User email
   * @returns {Promise<object|null>}
   */
  async getByEmail(email) {
    const results = await this.query([['email', '==', email]]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get users by role
   * @param {string} role - User role
   * @param {object} options - Query options
   * @returns {Promise<Array<object>>}
   */
  async getByRole(role, options = {}) {
    return this.query([['role', '==', role]], options);
  }

  /**
   * Create user with profile
   * @param {string} userId - User ID
   * @param {object} userData - User data
   * @param {object} profileData - Associated profile data
   * @returns {Promise<void>}
   */
  async createWithProfile(userId, userData, profileData) {
    const { getFirebaseAdmin } = require('../config/firebase');
    const { db, fieldValue } = getFirebaseAdmin();

    try {
      // Create user record
      await this.create(userId, userData);

      // Create associated profile
      const profileData_ = {
        ...profileData,
        userId,
        createdAt: fieldValue.serverTimestamp(),
      };
      await db.collection(COLLECTIONS.PROFILES).doc(userId).set(profileData_);
    } catch (error) {
      // Rollback if profile creation fails
      await this.delete(userId);
      throw error;
    }
  }

  /**
   * Deactivate user account
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async deactivate(userId) {
    await this.update(userId, { status: 'inactive', deactivatedAt: new Date().toISOString() });
  }

  /**
   * Activate user account
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async activate(userId) {
    await this.update(userId, { status: 'active', deactivatedAt: null });
  }
}

/**
 * AcademicRecordsRepository handles academic data
 */
class AcademicRecordsRepository extends BaseRepository {
  constructor() {
    super(COLLECTIONS.ACADEMIC_RECORDS);
  }

  /**
   * Get academic records for a scholar
   * @param {string} scholarId - Scholar ID
   * @returns {Promise<Array<object>>}
   */
  async getScholarRecords(scholarId) {
    return this.query([['scholarId', '==', scholarId]]);
  }

  /**
   * Get records by semester
   * @param {string} semester - Semester identifier
   * @returns {Promise<Array<object>>}
   */
  async getBySemester(semester) {
    return this.query([['semester', '==', semester]]);
  }

  /**
   * Calculate GPA for a scholar
   * @param {string} scholarId - Scholar ID
   * @returns {Promise<number>}
   */
  async calculateGPA(scholarId) {
    const records = await this.getScholarRecords(scholarId);
    if (records.length === 0) return 0;

    const totalPoints = records.reduce((sum, record) => {
      const credits = record.credits || 0;
      const grade = record.grade || 'F';
      const gradePoints = this.gradeToPoints(grade);
      return sum + gradePoints * credits;
    }, 0);

    const totalCredits = records.reduce((sum, record) => sum + (record.credits || 0), 0);
    return totalCredits > 0 ? totalPoints / totalCredits : 0;
  }

  /**
   * Convert letter grade to points
   * @param {string} grade - Letter grade
   * @returns {number}
   */
  gradeToPoints(grade) {
    const gradeMap = { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0 };
    return gradeMap[grade] || 0;
  }
}

/**
 * ScholarshipRepository handles scholarship data and applications
 */
class ScholarshipRepository extends BaseRepository {
  constructor() {
    super(COLLECTIONS.SCHOLARSHIPS);
  }

  /**
   * Get scholarships by status
   * @param {string} status - Scholarship status
   * @returns {Promise<Array<object>>}
   */
  async getByStatus(status) {
    return this.query([['status', '==', status]]);
  }

  /**
   * Get scholarships by scholar
   * @param {string} scholarId - Scholar ID
   * @returns {Promise<Array<object>>}
   */
  async getByScholar(scholarId) {
    return this.query([['scholarId', '==', scholarId]]);
  }

  /**
   * Get active scholarships
   * @returns {Promise<Array<object>>}
   */
  async getActive() {
    return this.query([['status', '==', 'active_scholar']]);
  }

  /**
   * Update scholarship status
   * @param {string} scholarshipId - Scholarship ID
   * @param {string} newStatus - New status
   * @param {object} metadata - Additional metadata
   * @returns {Promise<void>}
   */
  async updateStatus(scholarshipId, newStatus, metadata = {}) {
    await this.update(scholarshipId, {
      status: newStatus,
      statusUpdatedAt: new Date().toISOString(),
      ...metadata,
    });
  }
}

module.exports = {
  UserRepository,
  AcademicRecordsRepository,
  ScholarshipRepository,
};
