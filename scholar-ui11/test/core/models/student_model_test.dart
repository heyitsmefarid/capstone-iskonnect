import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/models/student_model.dart';

StudentModel _buildBaseStudent() {
  return StudentModel(
    firstName: 'Juan',
    middleName: '',
    lastName: 'Dela Cruz',
    street: 'Mabini St',
    barangay: 'San Vicente',
    city: 'Calapan',
    province: 'Oriental Mindoro',
    gender: 'Male',
    dateOfBirth: DateTime(2001, 3, 15),
    contactNumber: '09181234567',
    email: 'juan.delacruz@example.com',
    password: 'secret123',
    schoolName: 'Mindoro State University',
    yearLevel: '3',
    academicProgram: 'BS Computer Science',
    academicYear: '2025-2026',
    semester: '1st Semester',
  );
}

void main() {
  group('evaluation score fields', () {
    test('celebrationSeen defaults to false', () {
      expect(_buildBaseStudent().celebrationSeen, isFalse);
    });

    test('hasFullEvaluation is false until all three scores are set', () {
      final student = _buildBaseStudent();
      expect(student.hasFullEvaluation, isFalse);

      final partial =
          student.copyWith(requirementsScore: 18, economicScore: 25);
      expect(partial.hasFullEvaluation, isFalse);

      final full = partial.copyWith(examScore: 88);
      expect(full.hasFullEvaluation, isTrue);
    });

    test('totalEvaluationScore is null unless the evaluation is complete', () {
      final student = _buildBaseStudent()
          .copyWith(requirementsScore: 18, economicScore: 25);
      expect(student.totalEvaluationScore, isNull);
    });

    test('totalEvaluationScore applies requirements + economic + exam*0.5, rounded', () {
      final student = _buildBaseStudent().copyWith(
        requirementsScore: 18,
        economicScore: 25,
        examScore: 88,
      );
      // 18 + 25 + (88 * 0.5) = 87
      expect(student.totalEvaluationScore, 87);
    });

    test('round-trips requirementsScore/economicScore/examScore/celebrationSeen through JSON', () {
      final student = _buildBaseStudent().copyWith(
        requirementsScore: 20,
        economicScore: 30,
        examScore: 95.0,
        celebrationSeen: true,
      );

      final restored = StudentModel.fromJson(student.toJson());

      expect(restored.requirementsScore, 20);
      expect(restored.economicScore, 30);
      expect(restored.examScore, 95.0);
      expect(restored.celebrationSeen, isTrue);
    });
  });
}
