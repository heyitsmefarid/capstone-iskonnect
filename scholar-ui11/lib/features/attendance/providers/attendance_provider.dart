import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/core/models/attendance_model.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/core/services/scholar_firestore_service.dart';

class AttendanceNotifier extends StateNotifier<List<AttendanceModel>> {
  AttendanceNotifier() : super(const []) {
    _init();
  }

  StreamSubscription<Map<String, dynamic>?>? _docSub;

  Future<void> _init() async {
    try {
      final studentId = await ScholarFirestoreService.currentStudentId();
      if (studentId == null) return;

      // Ensure anonymous auth is ready before opening the live stream.
      await ScholarFirestoreService.fetchStudentDoc(studentId);

      // Live updates: re-parse attendance whenever the user doc changes (the QR
      // scanner appends scans here, and the admin edits them here too).
      _docSub = ScholarFirestoreService.studentDocStream(studentId).listen(
        (userDoc) => _applyUserDoc(studentId, userDoc),
        onError: (_) {},
      );
    } catch (_) {}
  }

  Future<void> _applyUserDoc(
      String studentId, Map<String, dynamic>? userDoc) async {
    // Prefer the attendance recorded directly on the user document (admin +
    // QR scanner). This is the shared source both apps write to.
    final docAttendance = userDoc?['attendance'];
    if (docAttendance is List && docAttendance.isNotEmpty) {
      state = docAttendance.map((item) {
        final m = Map<String, dynamic>.from(item as Map);
        final present = m['present'] == true ||
            m['status']?.toString().toLowerCase() == 'present';
        final date = ScholarFirestoreService.parseDateTime(
            m['date'] ?? m['attendedAt'] ?? m['createdAt']);
        return AttendanceModel(
          id: '${m['activity'] ?? m['activityName'] ?? date.millisecondsSinceEpoch}',
          activityName:
              '${m['activity'] ?? m['activityName'] ?? m['eventName'] ?? 'Attendance Record'}',
          date: date.year == 1970 ? DateTime.now() : date,
          status: present ? 'Present' : 'Absent',
          remarks: m['remarks']?.toString(),
        );
      }).toList();
      return;
    }

    // Fallback: attendance_logs the scanner wrote when no user-doc array exists.
    final records = await ScholarFirestoreService.fetchAttendanceLogs(studentId);
    if (records.isEmpty) {
      state = const [];
      return;
    }

    state = records.map((record) {
      final dateValue =
          record['attendedAt'] ?? record['date'] ?? record['createdAt'];
      final date = ScholarFirestoreService.parseDateTime(dateValue);
      final status = record['status']?.toString() ?? 'Present';

      return AttendanceModel(
        id: '${record['id'] ?? record['eventId'] ?? date.millisecondsSinceEpoch}',
        activityName:
            '${record['eventName'] ?? record['activityName'] ?? record['eventId'] ?? 'Attendance Record'}',
        date: date,
        status: status[0].toUpperCase() + status.substring(1).toLowerCase(),
        remarks: record['remarks']?.toString(),
      );
    }).toList();
  }

  @override
  void dispose() {
    _docSub?.cancel();
    super.dispose();
  }

  AttendanceSummary get summary {
    final present = state.where((a) => a.isPresent).length;
    final absent = state.where((a) => a.isAbsent).length;
    return AttendanceSummary(
      totalActivities: state.length,
      present: present,
      absent: absent,
    );
  }

  void addAttendance(AttendanceModel attendance) {
    state = [...state, attendance];
  }
}

final attendanceProvider =
    StateNotifierProvider<AttendanceNotifier, List<AttendanceModel>>((ref) {
      return AttendanceNotifier();
    });

final attendanceSummaryProvider = Provider<AttendanceSummary>((ref) {
  final student = ref.watch(currentStudentProvider);

  // St. Augustine doesn't require attendance
  if (student?.isStAugustine == true) {
    return AttendanceSummary(totalActivities: 0, present: 0, absent: 0);
  }

  return ref.watch(attendanceProvider.notifier).summary;
});
