import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/core/models/assessment_model.dart';

class AssessmentNotifier extends StateNotifier<List<AssessmentModel>> {
  AssessmentNotifier() : super(const []);

  void addAssessment(AssessmentModel assessment) {
    state = [...state, assessment];
  }

  void updateAssessment(AssessmentModel assessment) {
    state = state.map((a) => a.id == assessment.id ? assessment : a).toList();
  }

  List<AssessmentModel> getAssessmentsByYear(String academicYear) {
    return state.where((a) => a.academicYear == academicYear).toList();
  }

  AssessmentModel? getCurrentAssessment() {
    if (state.isEmpty) return null;
    return state.reduce(
      (a, b) => a.assessmentDate.isAfter(b.assessmentDate) ? a : b,
    );
  }
}

final assessmentProvider =
    StateNotifierProvider<AssessmentNotifier, List<AssessmentModel>>((ref) {
      return AssessmentNotifier();
    });

final assessmentSummaryProvider = Provider<AssessmentSummary>((ref) {
  final assessments = ref.watch(assessmentProvider);
  return AssessmentSummary.fromAssessments(assessments);
});

final currentAssessmentProvider = Provider<AssessmentModel?>((ref) {
  return ref.watch(assessmentProvider.notifier).getCurrentAssessment();
});
