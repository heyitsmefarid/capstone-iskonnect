import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/core/models/scholarship_timeline_model.dart';
import 'package:iskonnectttt/core/services/scholar_firestore_service.dart';

/// Provider for scholarship timeline
class ScholarshipTimelineNotifier extends StateNotifier<ScholarshipTimeline> {
  final bool isScholar;

  ScholarshipTimelineNotifier({this.isScholar = false}) : super(_defaultTimeline(isScholar: isScholar)) {
    _loadFromFirestore();
  }

  static ScholarshipTimeline _defaultTimeline({required bool isScholar}) {
    return ScholarshipTimeline(
      scholarId: 'current_user',
      milestones: _baseMilestones(isScholar: isScholar),
    );
  }

  static List<ScholarshipMilestone> _baseMilestones({required bool isScholar}) {
    final now = DateTime.now();
    return ScholarshipMilestoneType.values.map((type) {
      final achieved = type == ScholarshipMilestoneType.applicant ||
          (isScholar && type == ScholarshipMilestoneType.scholar);
      return ScholarshipMilestone(
        id: type.name,
        type: type,
        date: now,
        isAchieved: achieved,
      );
    }).toList();
  }

  Future<void> _loadFromFirestore() async {
    try {
      final studentId = await ScholarFirestoreService.currentStudentId();
      if (studentId == null) return;

      final studentDoc = await ScholarFirestoreService.fetchStudentDoc(studentId);
      if (studentDoc == null) return;

      final timelineEntries = await ScholarFirestoreService.fetchTimelineEntries(studentId);

      // Only an approved scholar advances past the Applicant milestone.
      // `studentType` is the authoritative signal (set when the admin approves
      // an applicant). We must NOT promote based on scholarshipStatus/status
      // alone — an applicant doc can carry a stale 'active' value, which the
      // rest of the app already normalizes back to Pending. Counting that here
      // wrongly marked the Scholar milestone achieved (showing 40% instead of
      // 20% for an applicant).
      final isApprovedScholar = studentDoc['studentType']?.toString() == 'scholar';

      final milestones = _baseMilestones(isScholar: isApprovedScholar);

      if (timelineEntries.isEmpty) {
        state = state.copyWith(scholarId: studentId, milestones: milestones);
        return;
      }

      for (final entry in timelineEntries) {
        final stage = entry['stage']?.toString();
        final toStatus = entry['toStatus']?.toString().toLowerCase();
        final date = ScholarFirestoreService.parseDateTime(entry['createdAt']);
        final message = [entry['action'], entry['fromStatus'], entry['toStatus']]
            .where((value) => value != null)
            .map((value) => value.toString())
            .join(' • ');

        if (stage == 'application' && (toStatus == 'submitted' || toStatus == 'approved' || toStatus == 'waitlisted' || toStatus == 'rejected')) {
          final index = milestones.indexWhere((milestone) => milestone.type == ScholarshipMilestoneType.applicant);
          if (index != -1) {
            milestones[index] = milestones[index].copyWith(
              isAchieved: true,
              date: date,
              message: message.isEmpty ? 'Application updated' : message,
            );
          }
        }

        if (stage == 'scholarship' && (toStatus == 'active_scholar' || toStatus == 'approved' || toStatus == 'active')) {
          final index = milestones.indexWhere((milestone) => milestone.type == ScholarshipMilestoneType.scholar);
          if (index != -1) {
            milestones[index] = milestones[index].copyWith(isAchieved: true, date: date, message: message.isEmpty ? 'Scholarship approved' : message);
          }
        }

        if (stage == 'scholarship' && toStatus == 'graduated') {
          final index = milestones.indexWhere((milestone) => milestone.type == ScholarshipMilestoneType.graduated);
          if (index != -1) {
            milestones[index] = milestones[index].copyWith(isAchieved: true, date: date, message: message.isEmpty ? 'Graduated' : message);
          }
        }
      }

      state = state.copyWith(scholarId: studentId, milestones: milestones);
    } catch (_) {}
  }

  void updateMilestone(ScholarshipMilestone updated) {
    state = state.copyWith(
      milestones: state.milestones.map((m) {
        if (m.id == updated.id) {
          return updated;
        }
        return m;
      }).toList(),
    );
  }

  void achieveMilestone(String id, {String? message}) {
    state = state.copyWith(
      milestones: state.milestones.map((m) {
        if (m.id == id) {
          return m.copyWith(
            isAchieved: true,
            date: DateTime.now(),
            message: message,
          );
        }
        return m;
      }).toList(),
    );
  }

  void unachieveMilestone(String id) {
    state = state.copyWith(
      milestones: state.milestones.map((m) {
        if (m.id == id) {
          return m.copyWith(isAchieved: false, message: null);
        }
        return m;
      }).toList(),
    );
  }

  void addMessage(String milestoneId, String message) {
    state = state.copyWith(
      milestones: state.milestones.map((m) {
        if (m.id == milestoneId) {
          return m.copyWith(message: message);
        }
        return m;
      }).toList(),
    );
  }
}

/// Provider to track if user is scholar or applicant (for timeline)
final isScholarForTimelineProvider = StateProvider<bool>((ref) => false);

final scholarshipTimelineProvider =
    StateNotifierProvider<ScholarshipTimelineNotifier, ScholarshipTimeline>((
      ref,
    ) {
      final isScholar = ref.watch(isScholarForTimelineProvider);
      return ScholarshipTimelineNotifier(isScholar: isScholar);
    });

/// Provider for current milestone
final currentMilestoneProvider = Provider<ScholarshipMilestone?>((ref) {
  final timeline = ref.watch(scholarshipTimelineProvider);
  return timeline.currentMilestone;
});

/// Provider for timeline progress
final timelineProgressProvider = Provider<double>((ref) {
  final timeline = ref.watch(scholarshipTimelineProvider);
  return timeline.progressPercentage;
});

/// Provider for scholarship disbursements
class DisbursementNotifier
    extends StateNotifier<List<ScholarshipDisbursement>> {
  DisbursementNotifier() : super(const []) {
    _loadFromFirestore();
  }

  Future<void> _loadFromFirestore() async {
    try {
      final studentId = await ScholarFirestoreService.currentStudentId();
      if (studentId == null) return;

      final studentDoc = await ScholarFirestoreService.fetchStudentDoc(studentId);

      // The grant for each semester the admin advanced the scholar into lives on
      // the user doc's `enrolledSemesters`. A scholar progresses sequentially —
      // their 1st granted term is "1st Semester" of their starting year, the 2nd
      // is "2nd Semester", and so on — so we derive each term's label from its
      // chronological position rather than whatever term happened to be active.
      final enrolled = studentDoc?['enrolledSemesters'];
      if (enrolled is List && enrolled.isNotEmpty) {
        final list = enrolled
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList()
          ..sort((a, b) => ScholarFirestoreService.parseDateTime(a['enrolledAt'])
              .compareTo(ScholarFirestoreService.parseDateTime(b['enrolledAt'])));

        final ay = studentDoc?['academicYear']?.toString() ?? '';
        final startYear = int.tryParse(ay.split('-').first) ?? DateTime.now().year;

        final mapped = <ScholarshipDisbursement>[];
        for (var i = 0; i < list.length; i++) {
          final e = list[i];
          final sy = startYear + (i ~/ 2); // new school year every 2 semesters
          final isFirstSem = i.isEven;
          mapped.add(ScholarshipDisbursement(
            id: '$sy-${isFirstSem ? 1 : 2}',
            semester: isFirstSem ? '1st Semester' : '2nd Semester',
            academicYear: '$sy-${sy + 1}',
            amount: (e['grantedAmount'] ?? 0).toDouble(),
            disbursedDate: ScholarFirestoreService.parseDateTime(e['enrolledAt']),
            status: e['status']?.toString() ?? 'disbursed',
          ));
        }
        if (mapped.isNotEmpty) {
          state = mapped;
          return;
        }
      }

      // Fallback: legacy disbursement records in the academic_records collection.
      final records = await ScholarFirestoreService.fetchAcademicRecords(studentId);
      if (records.isEmpty) return;

      final mapped = records.map((record) {
        final date = ScholarFirestoreService.parseDateTime(record['disbursedDate'] ?? record['createdAt']);

        return ScholarshipDisbursement(
          id: '${record['id'] ?? date.millisecondsSinceEpoch}',
          semester: record['semester']?.toString() ?? 'Unknown Semester',
          academicYear: record['academicYear']?.toString() ?? studentDoc?['academicYear']?.toString() ?? 'N/A',
          amount: (record['amount'] ?? record['amountGranted'] ?? 0).toDouble(),
          disbursedDate: date,
          status: record['status']?.toString() ?? 'pending',
        );
      }).toList();

      if (mapped.isNotEmpty) {
        state = mapped;
      }
    } catch (_) {}
  }
}

final disbursementsProvider =
    StateNotifierProvider<DisbursementNotifier, List<ScholarshipDisbursement>>((
      ref,
    ) {
      return DisbursementNotifier();
    });

/// Provider for total amount disbursed
final totalDisbursedAmountProvider = Provider<double>((ref) {
  final disbursements = ref.watch(disbursementsProvider);
  return disbursements
      .where((d) => d.status == 'disbursed')
      .fold<double>(0, (sum, d) => sum + d.amount);
});

/// Provider for current semester disbursement status
final currentSemesterDisbursementProvider = Provider<ScholarshipDisbursement?>((
  ref,
) {
  final disbursements = ref.watch(disbursementsProvider);
  // Get the latest (most recent) disbursement
  if (disbursements.isEmpty) return null;
  final sorted = List<ScholarshipDisbursement>.from(disbursements)
    ..sort((a, b) => b.disbursedDate.compareTo(a.disbursedDate));
  return sorted.first;
});
