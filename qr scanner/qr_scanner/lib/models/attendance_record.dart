import 'package:hive/hive.dart';

part 'attendance_record.g.dart';

/// Represents an attendance record for a student scan.
/// This model is stored locally using Hive and synced to the backend when online.
@HiveType(typeId: 0)
class AttendanceRecord extends HiveObject {
  /// Unique identifier for this attendance record
  @HiveField(0)
  final String id;

  /// The scanned student's unique ID from QR code
  @HiveField(1)
  final String studentId;

  /// Date and time when the scan occurred
  @HiveField(2)
  final DateTime scanDateTime;

  /// The event or activity name for this attendance
  @HiveField(3)
  final String eventName;

  /// The admin who performed the scan
  @HiveField(4)
  final String adminId;

  /// Whether this record has been synced to the backend
  @HiveField(5)
  bool isSynced;

  /// Timestamp when the record was synced (null if not synced)
  @HiveField(6)
  DateTime? syncedAt;

  /// Any additional notes for this scan
  @HiveField(7)
  String? notes;

  /// Student full name
  @HiveField(8)
  final String? studentName;

  /// Student school name
  @HiveField(9)
  final String? schoolName;

  /// Student program name
  @HiveField(10)
  final String? programName;

  /// Number of times a sync has been attempted for this record. Used to give
  /// up on records that can never resolve (e.g. a scan for a scholar id that
  /// doesn't exist yet) instead of retrying — and re-writing an audit log
  /// entry for — them forever every 30 seconds.
  @HiveField(11, defaultValue: 0)
  int syncAttempts;

  AttendanceRecord({
    required this.id,
    required this.studentId,
    required this.scanDateTime,
    required this.eventName,
    required this.adminId,
    this.isSynced = false,
    this.syncedAt,
    this.notes,
    this.studentName,
    this.schoolName,
    this.programName,
    this.syncAttempts = 0,
  });

  /// Creates a copy of this record with updated fields
  AttendanceRecord copyWith({
    String? id,
    String? studentId,
    DateTime? scanDateTime,
    String? eventName,
    String? adminId,
    bool? isSynced,
    DateTime? syncedAt,
    String? notes,
    String? studentName,
    String? schoolName,
    String? programName,
    int? syncAttempts,
  }) {
    return AttendanceRecord(
      id: id ?? this.id,
      studentId: studentId ?? this.studentId,
      scanDateTime: scanDateTime ?? this.scanDateTime,
      eventName: eventName ?? this.eventName,
      adminId: adminId ?? this.adminId,
      isSynced: isSynced ?? this.isSynced,
      syncedAt: syncedAt ?? this.syncedAt,
      notes: notes ?? this.notes,
      studentName: studentName ?? this.studentName,
      schoolName: schoolName ?? this.schoolName,
      programName: programName ?? this.programName,
      syncAttempts: syncAttempts ?? this.syncAttempts,
    );
  }

  /// Converts this record to a JSON map for API sync
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'studentId': studentId,
      'scanDateTime': scanDateTime.toIso8601String(),
      'eventName': eventName,
      'adminId': adminId,
      'isSynced': isSynced,
      'syncedAt': syncedAt?.toIso8601String(),
      'notes': notes,
      'studentName': studentName,
      'schoolName': schoolName,
      'programName': programName,
      'syncAttempts': syncAttempts,
    };
  }

  /// Creates a record from JSON data
  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      id: json['id'] as String,
      studentId: json['studentId'] as String,
      scanDateTime: DateTime.parse(json['scanDateTime'] as String),
      eventName: json['eventName'] as String,
      adminId: json['adminId'] as String,
      isSynced: json['isSynced'] as bool? ?? false,
      syncedAt: json['syncedAt'] != null
          ? DateTime.parse(json['syncedAt'] as String)
          : null,
      notes: json['notes'] as String?,
      studentName: json['studentName'] as String?,
      schoolName: json['schoolName'] as String?,
      programName: json['programName'] as String?,
      syncAttempts: json['syncAttempts'] as int? ?? 0,
    );
  }

  /// Gets just the date part for duplicate checking
  String get dateKey {
    return '${scanDateTime.year}-${scanDateTime.month.toString().padLeft(2, '0')}-${scanDateTime.day.toString().padLeft(2, '0')}';
  }

  @override
  String toString() {
    return 'AttendanceRecord(id: $id, studentId: $studentId, event: $eventName, synced: $isSynced)';
  }
}
