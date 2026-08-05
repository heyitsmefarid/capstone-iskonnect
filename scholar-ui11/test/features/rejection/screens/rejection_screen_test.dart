import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/models/student_model.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/rejection/screens/rejection_screen.dart';

StudentModel _buildStudent({String? rejectionReason}) {
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
    studentType: StudentType.applicant,
    rejectionReason: rejectionReason,
  );
}

Future<void> _pumpScreen(
  WidgetTester tester, {
  required StudentModel student,
  required VoidCallback onFinishedCalled,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        currentStudentProvider.overrideWithValue(student),
      ],
      child: MaterialApp(
        home: RejectionScreen(
          onFinished: (ref) async => onFinishedCalled(),
        ),
      ),
    ),
  );
  // Every section here is in the tree from the first frame (gated only by
  // `if`, not by phased state flags), each with its own `.animate(delay:
  // ...)`. The longest is the Continue button at delay 800ms + 400ms fade —
  // pump past that so no section's delay-timer is ever left pending when the
  // test ends.
  await tester.pump(const Duration(milliseconds: 1300));
}

void main() {
  testWidgets('shows the headline with the name and no score section', (tester) async {
    var finished = false;
    await _pumpScreen(
      tester,
      student: _buildStudent(),
      onFinishedCalled: () => finished = true,
    );

    expect(find.textContaining('Maria Santos'), findsOneWidget);
    expect(find.text('YOUR EVALUATION RESULT'), findsNothing);
    expect(finished, isFalse);
  });

  testWidgets('shows the reason box when rejectionReason is set', (tester) async {
    await _pumpScreen(
      tester,
      student: _buildStudent(rejectionReason: 'Incomplete requirements'),
      onFinishedCalled: () {},
    );

    expect(find.text('REASON'), findsOneWidget);
    expect(find.text('Incomplete requirements'), findsOneWidget);
  });

  testWidgets('omits the reason box when rejectionReason is absent', (tester) async {
    await _pumpScreen(
      tester,
      student: _buildStudent(),
      onFinishedCalled: () {},
    );

    expect(find.text('REASON'), findsNothing);
  });

  testWidgets('tapping Continue triggers finish', (tester) async {
    var finished = false;
    await _pumpScreen(
      tester,
      student: _buildStudent(),
      onFinishedCalled: () => finished = true,
    );

    await tester.tap(find.text('Continue'));
    await tester.pump(const Duration(milliseconds: 1));

    expect(finished, isTrue);
  });
}
