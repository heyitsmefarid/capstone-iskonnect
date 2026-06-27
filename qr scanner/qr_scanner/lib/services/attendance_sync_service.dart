import 'package:cloud_firestore/cloud_firestore.dart';

/// Service for syncing attendance records with Firestore.
class AttendanceSyncService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  /// Mark attendance for a student at an activity
  ///
  /// This is called when QR code is scanned
  Future<Map<String, dynamic>> markAttendance({
    required int studentId,
    required int activityId,
    required DateTime timestamp,
  }) async {
    try {
      final ref = await _db.collection('attendance_logs').add({
        'studentId': studentId,
        'activityId': activityId,
        'attendedAt': Timestamp.fromDate(timestamp),
        'markedVia': 'qr_scanner',
        'createdAt': FieldValue.serverTimestamp(),
      });

      final saved = await ref.get();
      final data = saved.data() ?? <String, dynamic>{};
      data['id'] = ref.id;
      return data;
    } catch (e) {
      throw Exception('Failed to mark attendance: $e');
    }
  }

  /// Get student details from student_id
  Future<Map<String, dynamic>?> getStudentById(int studentId) async {
    try {
      final query = await _db
          .collection('profiles')
          .where('legacyStudentId', isEqualTo: studentId)
          .limit(1)
          .get();

      if (query.docs.isEmpty) {
        return null;
      }

      return query.docs.first.data();
    } catch (e) {
      throw Exception('Failed to fetch student: $e');
    }
  }

  /// Get activity details from activity_id
  Future<Map<String, dynamic>?> getActivityById(int activityId) async {
    try {
      final query = await _db
          .collection('attendance_events')
          .where('legacyActivityId', isEqualTo: activityId)
          .limit(1)
          .get();

      if (query.docs.isEmpty) {
        return null;
      }

      return query.docs.first.data();
    } catch (e) {
      throw Exception('Failed to fetch activity: $e');
    }
  }

  /// Get all active activities (for selection dropdown)
  Future<List<Map<String, dynamic>>> getActiveActivities() async {
    try {
      final query = await _db
          .collection('attendance_events')
          .orderBy('activityDate', descending: true)
          .limit(50)
          .get();

      return query.docs.map((doc) => doc.data()).toList();
    } catch (e) {
      throw Exception('Failed to fetch activities: $e');
    }
  }

  /// Batch sync offline attendance records
  Future<void> syncOfflineAttendance(List<Map<String, dynamic>> records) async {
    try {
      final batch = _db.batch();
      for (final record in records) {
        final ref = _db.collection('attendance_logs').doc();
        batch.set(ref, {
          ...record,
          'createdAt': FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (e) {
      throw Exception('Failed to sync offline attendance: $e');
    }
  }

  /// Check if student has already attended this activity
  Future<bool> hasAttended({
    required int studentId,
    required int activityId,
  }) async {
    try {
      final query = await _db
          .collection('attendance_logs')
          .where('studentId', isEqualTo: studentId)
          .where('activityId', isEqualTo: activityId)
          .limit(1)
          .get();

      return query.docs.isNotEmpty;
    } catch (e) {
      return false;
    }
  }

  /// Get attendance statistics for an activity
  Future<Map<String, dynamic>> getActivityStats(int activityId) async {
    try {
      final attendanceResponse = await _db
        .collection('attendance_logs')
        .where('activityId', isEqualTo: activityId)
        .count()
        .get();

      final studentsResponse = await _db
        .collection('scholarships')
        .where('status', isEqualTo: 'active')
        .count()
        .get();

      final attended = attendanceResponse.count ?? 0;
      final total = studentsResponse.count ?? 0;

      return {
        'attended': attended,
        'total': total,
        'percentage': total > 0
            ? ((attended / total) * 100).toStringAsFixed(1)
            : '0.0',
      };
    } catch (e) {
      throw Exception('Failed to get activity stats: $e');
    }
  }
}
