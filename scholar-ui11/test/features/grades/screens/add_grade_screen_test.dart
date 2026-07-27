import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/grades/screens/add_grade_screen.dart';
import 'package:iskonnectttt/shared/widgets/custom_button.dart';

// activeAcademicPeriodProvider is deliberately NOT overridden here: without
// Firebase initialized its real implementation throws, which
// AddGradeScreen._loadActivePeriod() already catches and falls back to its
// own hardcoded defaults - the same values an override would inject. Not
// overriding it also keeps this test agnostic to that provider's exact
// shape (Future vs Stream), which is mid-change in unrelated, separate
// uncommitted work.
Future<void> _pumpAddSubjectScreen(WidgetTester tester) {
  return tester.pumpWidget(
    ProviderScope(
      overrides: [
        currentStudentProvider.overrideWithValue(null),
      ],
      child: const MaterialApp(home: AddGradeScreen()),
    ),
  );
}

void main() {
  testWidgets('Add Subject form has no Grade or Remarks fields', (tester) async {
    await _pumpAddSubjectScreen(tester);
    await tester.pumpAndSettle();

    // Code/Name field labels aren't this task's concern (an unrelated,
    // separate rename is still in progress elsewhere) - just confirm the two
    // non-grade fields remain and nothing grade/remarks-related does.
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.text('Units'), findsOneWidget);
    expect(find.text('Grade'), findsNothing);
    expect(find.text('Remarks'), findsNothing);
    expect(
      find.text(
        "Add your subject details. You can input the grade once it's released.",
      ),
      findsOneWidget,
    );
  });

  testWidgets('submitting the code + name fields succeeds without a grade', (
    tester,
  ) async {
    await _pumpAddSubjectScreen(tester);
    await tester.pumpAndSettle();

    final textFields = find.byType(TextFormField);
    expect(textFields, findsNWidgets(2)); // subject code, subject name only

    await tester.enterText(textFields.at(0), 'IT101');
    await tester.enterText(textFields.at(1), 'Introduction to Computing');

    // Scroll down to see the button
    await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -300));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(GradientButton));
    await tester.pumpAndSettle();

    expect(find.text('Subject Added'), findsOneWidget);
  });
}
