import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/models/student_model.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/celebration/screens/congratulations_screen.dart';

StudentModel _buildStudent({
  int? requirementsScore,
  int? economicScore,
  double? examScore,
}) {
  return StudentModel(
    firstName: 'Maria',
    middleName: '',
    lastName: 'Santos',
    street: 'Luna St',
    barangay: 'Camilmil',
    city: 'Calapan',
    province: 'Oriental Mindoro',
    gender: 'Female',
    dateOfBirth: DateTime(2001, 8, 20),
    contactNumber: '09991234567',
    email: 'maria.santos@example.com',
    password: 'secret123',
    schoolName: 'Mindoro State University',
    yearLevel: '3',
    academicProgram: 'BS Accountancy',
    academicYear: '2025-2026',
    semester: '1st Semester',
    studentType: StudentType.scholar,
    requirementsScore: requirementsScore,
    economicScore: economicScore,
    examScore: examScore,
  );
}

Future<void> _pumpScreen(
  WidgetTester tester, {
  required StudentModel student,
  required VoidCallback onFinishedCalled,
}) {
  return tester.pumpWidget(
    ProviderScope(
      overrides: [
        currentStudentProvider.overrideWithValue(student),
      ],
      child: MaterialApp(
        home: CongratulationsScreen(
          onFinished: (ref) async => onFinishedCalled(),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('shows the headline with the name first, before any scores', (tester) async {
    var finished = false;
    await _pumpScreen(
      tester,
      student: _buildStudent(requirementsScore: 18, economicScore: 25, examScore: 88),
      onFinishedCalled: () => finished = true,
    );
    // A nonzero pump (rather than a bare `pump()`) is required here: mounting
    // the headline's `.animate()` schedules a zero-duration internal timer
    // (flutter_animate's delay-then-play future), and flutter_test only
    // drains fake-clock timers when the pump actually advances time.
    await tester.pump(const Duration(milliseconds: 1));

    expect(find.textContaining('Maria Santos'), findsOneWidget);
    expect(find.text('YOUR EVALUATION RESULTS'), findsNothing);
    expect(finished, isFalse);
  });

  testWidgets('reveals the scores after the headline phase, then Continue triggers finish', (tester) async {
    var finished = false;
    await _pumpScreen(
      tester,
      student: _buildStudent(requirementsScore: 18, economicScore: 25, examScore: 88),
      onFinishedCalled: () => finished = true,
    );

    await tester.pump(const Duration(milliseconds: 2900)); // past phase 1
    // Nonzero: the score rings just mounted their own `.animate()` calls.
    await tester.pump(const Duration(milliseconds: 1));

    expect(find.textContaining('Maria Santos'), findsNothing);
    expect(find.text('YOUR EVALUATION RESULTS'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 900)); // Continue button appears
    expect(find.text('Continue'), findsOneWidget);

    await tester.tap(find.text('Continue'));
    await tester.pump(const Duration(milliseconds: 1));

    expect(finished, isTrue);
  });

  testWidgets('auto-advances even if Continue is never tapped', (tester) async {
    var finished = false;
    await _pumpScreen(
      tester,
      student: _buildStudent(requirementsScore: 18, economicScore: 25, examScore: 88),
      onFinishedCalled: () => finished = true,
    );

    await tester.pump(const Duration(milliseconds: 2900)); // past phase 1
    await tester.pump(const Duration(milliseconds: 900)); // Continue appears
    expect(finished, isFalse);

    await tester.pump(const Duration(milliseconds: 2600)); // auto-advance buffer elapses
    expect(finished, isTrue);
  });

  testWidgets('skips the score section entirely when no scores exist yet', (tester) async {
    var finished = false;
    await _pumpScreen(
      tester,
      student: _buildStudent(),
      onFinishedCalled: () => finished = true,
    );

    await tester.pump(const Duration(milliseconds: 2900)); // past phase 1
    // Nonzero: the Continue button just mounted its own `.animate()` call.
    await tester.pump(const Duration(milliseconds: 1));

    expect(find.text('YOUR EVALUATION RESULTS'), findsNothing);
    expect(find.textContaining('Maria Santos'), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);
  });
}
