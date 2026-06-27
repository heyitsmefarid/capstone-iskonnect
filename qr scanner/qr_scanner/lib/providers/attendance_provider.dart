import 'package:flutter/foundation.dart';
import 'dart:convert';
import '../models/models.dart';
import '../services/services.dart';

/// Result of a scan operation
enum ScanResultType { success, duplicate, error }

class ScanResult {
  final ScanResultType type;
  final String message;
  final AttendanceRecord? record;

  ScanResult({required this.type, required this.message, this.record});

  bool get isSuccess => type == ScanResultType.success;
  bool get isDuplicate => type == ScanResultType.duplicate;
  bool get isError => type == ScanResultType.error;
}

/// Provider for managing attendance state.
/// Handles QR scanning, duplicate detection, and attendance tracking.
class AttendanceProvider extends ChangeNotifier {
  final StorageService _storageService = StorageService();
  final SyncService _syncService = SyncService();

  List<AttendanceRecord> _todayRecords = [];
  List<AttendanceRecord> _allRecords = [];
  ScanResult? _lastScanResult;
  bool _isProcessing = false;
  Event? _currentEvent;

  /// Today's attendance records
  List<AttendanceRecord> get todayRecords => _todayRecords;

  /// All attendance records
  List<AttendanceRecord> get allRecords => _allRecords;

  /// Today's attendance count
  int get todayCount => _todayRecords.length;

  /// Total unsynced count
  int get unsyncedCount => _storageService.getUnsyncedCount();

  /// Last scan result
  ScanResult? get lastScanResult => _lastScanResult;

  /// Whether currently processing a scan
  bool get isProcessing => _isProcessing;

  /// Current event
  Event? get currentEvent => _currentEvent;

  /// All available events sorted by newest event date first
  List<Event> get events {
    final allEvents = _storageService.getAllEvents();
    allEvents.sort((a, b) => b.date.compareTo(a.date));
    return allEvents;
  }

  /// Initialize the provider
  Future<void> initialize() async {
    await _refreshData();
    _currentEvent = _storageService.getCurrentEvent();
    _currentEvent ??= events.isNotEmpty ? events.first : null;
  }

  /// Refresh data from storage
  Future<void> _refreshData() async {
    _todayRecords = _storageService.getTodayAttendanceRecords();
    _allRecords = _storageService.getAllAttendanceRecords();
    notifyListeners();
  }

  /// Process a scanned QR code
  Future<ScanResult> processQrCode(String qrData) async {
    if (_isProcessing) {
      return ScanResult(
        type: ScanResultType.error,
        message: 'Already processing a scan',
      );
    }

    _isProcessing = true;
    notifyListeners();

    try {
      // Parse the QR payload
      final qrPayload = _parseQrData(qrData);
      final studentId = qrPayload.studentId;

      if (studentId == null || studentId.isEmpty) {
        _lastScanResult = ScanResult(
          type: ScanResultType.error,
          message: 'Invalid QR code format',
        );
        return _lastScanResult!;
      }

      // Get current event
      final eventName = _currentEvent?.name ?? 'General Attendance';

      // Check for duplicate scan
      if (_storageService.isStudentScannedToday(studentId, eventName)) {
        final duplicateName = qrPayload.studentName?.trim().isNotEmpty == true
            ? qrPayload.studentName!.trim()
            : studentId;
        _lastScanResult = ScanResult(
          type: ScanResultType.duplicate,
          message: '$duplicateName already scanned today',
        );
        return _lastScanResult!;
      }

      // Create attendance record
      final record = AttendanceRecord(
        id: _storageService.generateId(),
        studentId: studentId,
        scanDateTime: DateTime.now(),
        eventName: eventName,
        adminId: _storageService.getCurrentAdminId() ?? 'unknown',
        isSynced: false,
        studentName: qrPayload.studentName,
        schoolName: qrPayload.schoolName,
        programName: qrPayload.programName,
        notes: qrPayload.cardDateText != null
            ? 'QR Card Date: ${qrPayload.cardDateText}'
            : null,
      );

      // Save to local storage
      await _storageService.addAttendanceRecord(record);

      // Refresh data
      await _refreshData();

      _lastScanResult = ScanResult(
        type: ScanResultType.success,
        message:
            'Scan successful: ${record.studentName?.trim().isNotEmpty == true ? record.studentName!.trim() : record.studentId}',
        record: record,
      );

      // Trigger sync if online and auto-sync enabled
      if (_storageService.isAutoSyncEnabled()) {
        _syncService.syncNow();
      }

      return _lastScanResult!;
    } catch (e) {
      _lastScanResult = ScanResult(
        type: ScanResultType.error,
        message: 'Error processing scan: ${e.toString()}',
      );
      return _lastScanResult!;
    } finally {
      _isProcessing = false;
      notifyListeners();
    }
  }

  /// Parse QR payload for student and profile fields
  QrPayload _parseQrData(String qrData) {
    Map<String, dynamic>? jsonData;

    // Try to parse as JSON first
    try {
      if (qrData.startsWith('{')) {
        final decoded = jsonDecode(qrData);
        if (decoded is Map<String, dynamic>) {
          jsonData = decoded;
        }
      }
    } catch (_) {
      // not JSON
    }

    if (jsonData != null) {
      final studentId = _extractFromJson(jsonData, const [
        'studentId',
        'student_id',
        'id',
        'studentNumber',
      ]);

      if (studentId != null && studentId.isNotEmpty) {
        return QrPayload(
          studentId: studentId,
          studentName: _extractFromJson(jsonData, const [
            'name',
            'studentName',
            'full_name',
            'fullName',
          ]),
          schoolName: _extractFromJson(jsonData, const [
            'school',
            'schoolName',
            'college',
          ]),
          programName: _extractFromJson(jsonData, const [
            'program',
            'programName',
            'course',
          ]),
        );
      }
    }

    // Parse labeled text QR cards (example: Scholar Name, School, Program, Date)
    final labeledPayload = _parseLabeledCardText(qrData);
    if (labeledPayload != null) {
      return labeledPayload;
    }

    // Plain text - treat the entire content as student ID
    final cleanData = qrData.trim();

    if (RegExp(r'^[a-zA-Z0-9\-_]+$').hasMatch(cleanData)) {
      return QrPayload(studentId: cleanData);
    }

    final match = RegExp(r'([a-zA-Z0-9\-_]+)').firstMatch(cleanData);
    return QrPayload(studentId: match?.group(1));
  }

  QrPayload? _parseLabeledCardText(String qrData) {
    final normalized = qrData.replaceAll('\r\n', '\n').trim();
    if (normalized.isEmpty) return null;

    String? studentId;
    String? studentName;
    String? schoolName;
    String? programName;
    String? cardDateText;

    final lines = normalized
        .split('\n')
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .toList();

    for (final line in lines) {
      final idMatch = RegExp(
        r'^(Student\s*ID|Student\s*No\.?|ID)\s*:\s*(.+)$',
        caseSensitive: false,
      ).firstMatch(line);
      if (idMatch != null) {
        studentId = idMatch.group(2)?.trim();
      }

      final nameMatch = RegExp(
        r'^(Scholar\s*Name|Name)\s*:\s*(.+)$',
        caseSensitive: false,
      ).firstMatch(line);
      if (nameMatch != null) {
        studentName = nameMatch.group(2)?.trim();
      }

      final schoolProgramMatch = RegExp(
        r'^School\s*:\s*(.+?)\s+Program\s*:\s*(.+)$',
        caseSensitive: false,
      ).firstMatch(line);
      if (schoolProgramMatch != null) {
        schoolName = schoolProgramMatch.group(1)?.trim();
        programName = schoolProgramMatch.group(2)?.trim();
      }

      final schoolMatch = RegExp(
        r'^School\s*:\s*(.+)$',
        caseSensitive: false,
      ).firstMatch(line);
      if (schoolMatch != null && schoolName == null) {
        schoolName = schoolMatch.group(1)?.trim();
      }

      final programMatch = RegExp(
        r'^Program\s*:\s*(.+)$',
        caseSensitive: false,
      ).firstMatch(line);
      if (programMatch != null) {
        programName = programMatch.group(1)?.trim();
      }

      final dateMatch = RegExp(
        r'^Date\s*:\s*([0-9]{2}/[0-9]{2}/[0-9]{4})$',
        caseSensitive: false,
      ).firstMatch(line);
      if (dateMatch != null) {
        cardDateText = dateMatch.group(1)?.trim();
      }
    }

    // If no labeled fields found, this isn't the expected card format
    if (studentName == null && schoolName == null && programName == null) {
      return null;
    }

    // Build stable fallback ID for cards without explicit ID
    studentId ??= _buildFallbackStudentId(
      studentName: studentName,
      schoolName: schoolName,
      programName: programName,
    );

    return QrPayload(
      studentId: studentId,
      studentName: studentName,
      schoolName: schoolName,
      programName: programName,
      cardDateText: cardDateText,
    );
  }

  String _buildFallbackStudentId({
    String? studentName,
    String? schoolName,
    String? programName,
  }) {
    final source = [studentName, schoolName, programName]
        .whereType<String>()
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .join('-')
        .toLowerCase();

    final cleaned = source.replaceAll(RegExp(r'[^a-z0-9]+'), '_');
    final compact = cleaned.replaceAll(RegExp(r'_+'), '_');
    final trimmed = compact.replaceAll(RegExp(r'^_|_$'), '');

    if (trimmed.isEmpty) {
      return 'unknown_student';
    }

    return trimmed.length > 50 ? trimmed.substring(0, 50) : trimmed;
  }

  String? _extractFromJson(Map<String, dynamic> json, List<String> keys) {
    for (final key in keys) {
      final value = json[key];
      if (value == null) continue;
      final asText = value.toString().trim();
      if (asText.isNotEmpty) return asText;
    }
    return null;
  }

  /// Clear the last scan result
  void clearLastScanResult() {
    _lastScanResult = null;
    notifyListeners();
  }

  /// Set current event
  Future<void> setCurrentEvent(Event event) async {
    _currentEvent = event;
    await _storageService.setCurrentEvent(event.id);
    notifyListeners();
  }

  /// Create and store a new event, optionally selecting it as current
  Future<Event> addEvent({
    required String name,
    String? description,
    required DateTime date,
    bool setAsCurrent = true,
  }) async {
    final event = Event(
      id: _storageService.generateId(),
      name: name.trim(),
      description: description?.trim().isEmpty ?? true
          ? null
          : description!.trim(),
      date: DateTime(date.year, date.month, date.day),
      isActive: true,
      createdAt: DateTime.now(),
    );

    await _storageService.addEvent(event);

    if (setAsCurrent) {
      await setCurrentEvent(event);
    } else {
      notifyListeners();
    }

    return event;
  }

  /// Get attendance records for a specific date
  List<AttendanceRecord> getRecordsByDate(DateTime date) {
    return _storageService.getAttendanceRecordsByDate(date);
  }

  /// Get records grouped by date
  Map<String, List<AttendanceRecord>> getRecordsGroupedByDate() {
    final grouped = <String, List<AttendanceRecord>>{};

    for (final record in _allRecords) {
      final dateKey = record.dateKey;
      if (!grouped.containsKey(dateKey)) {
        grouped[dateKey] = [];
      }
      grouped[dateKey]!.add(record);
    }

    // Sort by date (newest first)
    final sortedKeys = grouped.keys.toList()..sort((a, b) => b.compareTo(a));

    return Map.fromEntries(
      sortedKeys.map((key) => MapEntry(key, grouped[key]!)),
    );
  }

  /// Refresh all data
  Future<void> refresh() async {
    await _refreshData();
  }

  /// Clear all attendance data
  Future<void> clearAllData() async {
    await _storageService.clearAllData();
    await _refreshData();
  }
}

class QrPayload {
  final String? studentId;
  final String? studentName;
  final String? schoolName;
  final String? programName;
  final String? cardDateText;

  const QrPayload({
    required this.studentId,
    this.studentName,
    this.schoolName,
    this.programName,
    this.cardDateText,
  });
}
