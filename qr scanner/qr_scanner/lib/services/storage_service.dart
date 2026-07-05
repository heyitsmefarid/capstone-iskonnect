import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import '../models/models.dart';

/// Service for managing local storage using Hive.
/// Handles all CRUD operations for attendance records, events, and admin data.
class StorageService {
  // Box names
  static const String attendanceBoxName = 'attendance_records';
  static const String eventsBoxName = 'events';
  static const String adminBoxName = 'admin';
  static const String settingsBoxName = 'settings';

  // Singleton pattern
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  // Boxes
  late Box<AttendanceRecord> _attendanceBox;
  late Box<Event> _eventsBox;
  late Box<Admin> _adminBox;
  late Box<dynamic> _settingsBox;

  // UUID generator
  final Uuid _uuid = const Uuid();

  /// Initialize Hive and open all boxes
  Future<void> initialize() async {
    // Initialize Hive for Flutter
    await Hive.initFlutter();

    // Register adapters
    if (!Hive.isAdapterRegistered(0)) {
      Hive.registerAdapter(AttendanceRecordAdapter());
    }
    if (!Hive.isAdapterRegistered(1)) {
      Hive.registerAdapter(EventAdapter());
    }
    if (!Hive.isAdapterRegistered(2)) {
      Hive.registerAdapter(AdminAdapter());
    }

    // Open boxes
    _attendanceBox = await Hive.openBox<AttendanceRecord>(attendanceBoxName);
    _eventsBox = await Hive.openBox<Event>(eventsBoxName);
    _adminBox = await Hive.openBox<Admin>(adminBoxName);
    _settingsBox = await Hive.openBox<dynamic>(settingsBoxName);

    // Create default admin if none exists
    await _ensureDefaultAdmin();

    // Events are no longer seeded locally — they're fetched live from the
    // admin-scheduled `events` Firestore collection (see EventsService) and
    // cached into this same box for offline use.
  }

  /// Ensure a default admin exists
  Future<void> _ensureDefaultAdmin() async {
    if (_adminBox.isEmpty) {
      final defaultAdmin = Admin(
        id: _uuid.v4(),
        name: 'Default Admin',
        email: 'admin@iskonnect.edu',
        department: 'Administration',
        createdAt: DateTime.now(),
      );
      await _adminBox.put(defaultAdmin.id, defaultAdmin);
      await _settingsBox.put('currentAdminId', defaultAdmin.id);
    }
  }

  // ==================== ATTENDANCE RECORDS ====================

  /// Generate a unique ID
  String generateId() => _uuid.v4();

  /// Add a new attendance record
  Future<AttendanceRecord> addAttendanceRecord(AttendanceRecord record) async {
    await _attendanceBox.put(record.id, record);
    return record;
  }

  /// Get all attendance records
  List<AttendanceRecord> getAllAttendanceRecords() {
    return _attendanceBox.values.toList();
  }

  /// Get attendance records for today
  List<AttendanceRecord> getTodayAttendanceRecords() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    return _attendanceBox.values.where((record) {
      final recordDate = DateTime(
        record.scanDateTime.year,
        record.scanDateTime.month,
        record.scanDateTime.day,
      );
      return recordDate.isAtSameMomentAs(today);
    }).toList();
  }

  /// Get attendance records for a specific date
  List<AttendanceRecord> getAttendanceRecordsByDate(DateTime date) {
    final targetDate = DateTime(date.year, date.month, date.day);

    return _attendanceBox.values.where((record) {
      final recordDate = DateTime(
        record.scanDateTime.year,
        record.scanDateTime.month,
        record.scanDateTime.day,
      );
      return recordDate.isAtSameMomentAs(targetDate);
    }).toList();
  }

  /// Get unsynced attendance records
  List<AttendanceRecord> getUnsyncedRecords() {
    return _attendanceBox.values.where((record) => !record.isSynced).toList();
  }

  /// Check if a student was already scanned today for the selected event
  bool isStudentScannedToday(String studentId, String eventName) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    return _attendanceBox.values.any((record) {
      final recordDate = DateTime(
        record.scanDateTime.year,
        record.scanDateTime.month,
        record.scanDateTime.day,
      );
      return record.studentId == studentId &&
          record.eventName == eventName &&
          recordDate.isAtSameMomentAs(today);
    });
  }

  /// Mark a record as synced
  Future<void> markRecordAsSynced(String recordId) async {
    final record = _attendanceBox.get(recordId);
    if (record != null) {
      record.isSynced = true;
      record.syncedAt = DateTime.now();
      await record.save();
    }
  }

  /// Mark multiple records as synced
  Future<void> markRecordsAsSynced(List<String> recordIds) async {
    for (final id in recordIds) {
      await markRecordAsSynced(id);
    }
  }

  /// Record a failed sync attempt for a record that couldn't be resolved yet
  /// (e.g. no matching scholar found). Returns the updated attempt count.
  Future<int> incrementSyncAttempts(String recordId) async {
    final record = _attendanceBox.get(recordId);
    if (record == null) return 0;
    record.syncAttempts += 1;
    await record.save();
    return record.syncAttempts;
  }

  /// Give up on a record that has exceeded the retry cap so it stops being
  /// re-attempted (and re-billed against the Firestore write quota) forever.
  Future<void> giveUpOnRecord(String recordId, {required String reason}) async {
    final record = _attendanceBox.get(recordId);
    if (record != null) {
      record.isSynced = true;
      record.syncedAt = DateTime.now();
      record.notes = [record.notes, reason].whereType<String>().join(' — ');
      await record.save();
    }
  }

  /// Delete synced records (cleanup after successful sync)
  Future<int> deleteSyncedRecords() async {
    final syncedRecords = _attendanceBox.values
        .where((record) => record.isSynced)
        .toList();

    for (final record in syncedRecords) {
      await _attendanceBox.delete(record.id);
    }

    return syncedRecords.length;
  }

  /// Get attendance count for today
  int getTodayAttendanceCount() {
    return getTodayAttendanceRecords().length;
  }

  /// Get total unsynced count
  int getUnsyncedCount() {
    return getUnsyncedRecords().length;
  }

  // ==================== EVENTS ====================
  // Events are scheduled by the admin (admin-ui) and fetched live from
  // Firestore by EventsService — this box only caches the latest fetch so
  // the picker still works offline.

  /// Replace the cached event list with the latest fetch from Firestore.
  Future<void> replaceEventsCache(List<Event> events) async {
    await _eventsBox.clear();
    for (final event in events) {
      await _eventsBox.put(event.id, event);
    }
  }

  /// Get all cached events
  List<Event> getAllEvents() {
    return _eventsBox.values.toList();
  }

  /// Get event by ID
  Event? getEventById(String id) {
    return _eventsBox.get(id);
  }

  /// Set current event
  Future<void> setCurrentEvent(String eventId) async {
    await _settingsBox.put('currentEventId', eventId);
  }

  /// Clear the current event selection (e.g. it was deleted by the admin)
  Future<void> clearCurrentEvent() async {
    await _settingsBox.delete('currentEventId');
  }

  /// Get current event ID
  String? getCurrentEventId() {
    return _settingsBox.get('currentEventId') as String?;
  }

  /// Get current event
  Event? getCurrentEvent() {
    final eventId = getCurrentEventId();
    if (eventId == null) return null;
    return getEventById(eventId);
  }

  // ==================== ADMIN ====================

  /// Get current admin
  Admin? getCurrentAdmin() {
    final adminId = _settingsBox.get('currentAdminId') as String?;
    if (adminId == null) return null;
    return _adminBox.get(adminId);
  }

  /// Get current admin ID
  String? getCurrentAdminId() {
    return _settingsBox.get('currentAdminId') as String?;
  }

  /// Update admin
  Future<void> updateAdmin(Admin admin) async {
    await _adminBox.put(admin.id, admin);
  }

  // ==================== SETTINGS ====================

  /// Get dark mode setting
  bool isDarkMode() {
    return _settingsBox.get('darkMode', defaultValue: false) as bool;
  }

  /// Set dark mode
  Future<void> setDarkMode(bool value) async {
    await _settingsBox.put('darkMode', value);
  }

  /// Get API endpoint
  String getApiEndpoint() {
    return _settingsBox.get(
          'apiEndpoint',
          defaultValue: 'https://api.iskonnect.edu/v1',
        )
        as String;
  }

  /// Set API endpoint
  Future<void> setApiEndpoint(String endpoint) async {
    await _settingsBox.put('apiEndpoint', endpoint);
  }

  /// Get auto-sync setting
  bool isAutoSyncEnabled() {
    return _settingsBox.get('autoSync', defaultValue: true) as bool;
  }

  /// Set auto-sync
  Future<void> setAutoSync(bool value) async {
    await _settingsBox.put('autoSync', value);
  }

  /// Clear all data (for testing/reset)
  Future<void> clearAllData() async {
    await _attendanceBox.clear();
    await _eventsBox.clear();
    await _settingsBox.delete('currentEventId');
  }

  /// Close all boxes
  Future<void> close() async {
    await _attendanceBox.close();
    await _eventsBox.close();
    await _adminBox.close();
    await _settingsBox.close();
  }
}
