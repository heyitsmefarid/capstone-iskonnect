const BaseRepository = require('./BaseRepository');
const AttendanceRepository = require('./AttendanceRepository');
const { UserRepository, AcademicRecordsRepository, ScholarshipRepository } = require('./UserRepository');

/**
 * Factory for creating repository instances
 * Ensures single instances per repository type
 */
class RepositoryFactory {
  static #instances = {};

  static getAttendanceRepository() {
    if (!this.#instances.attendance) {
      this.#instances.attendance = new AttendanceRepository();
    }
    return this.#instances.attendance;
  }

  static getUserRepository() {
    if (!this.#instances.user) {
      this.#instances.user = new UserRepository();
    }
    return this.#instances.user;
  }

  static getAcademicRecordsRepository() {
    if (!this.#instances.academicRecords) {
      this.#instances.academicRecords = new AcademicRecordsRepository();
    }
    return this.#instances.academicRecords;
  }

  static getScholarshipRepository() {
    if (!this.#instances.scholarship) {
      this.#instances.scholarship = new ScholarshipRepository();
    }
    return this.#instances.scholarship;
  }
}

module.exports = {
  RepositoryFactory,
  BaseRepository,
  AttendanceRepository,
  UserRepository,
  AcademicRecordsRepository,
  ScholarshipRepository,
};
