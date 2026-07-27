# Split Subject Creation From Grade Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the scholar app's Grades feature, adding a subject no longer requires a Grade/Remarks upfront; a dynamic per-subject button ("Input Grade" while ungraded, "Edit" once graded) handles grading afterward.

**Architecture:** Two independent, small edits in existing files — no new screens, no new routes, no data-model changes (`GradeModel.grade`/`.remarks` are already nullable). Task 1 removes two form fields from `AddGradeScreen`. Task 2 extracts the existing per-subject action button's label/icon/color choice into a small public pure function (`subjectActionButtonStyle`) inside `grades_screen.dart`, so it's unit-testable without rendering the widget tree, and wires it into `_SubjectCard`.

**Tech Stack:** Flutter, Riverpod (`flutter_riverpod: ^2.4.9`), `flutter_test` (existing test suite — run via `flutter test` from `scholar-ui11/`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-26-subject-grade-input-split-design.md`.
- Only `scholar-ui11/lib/features/grades/screens/add_grade_screen.dart` and `scholar-ui11/lib/features/grades/screens/grades_screen.dart` change (plus their new test files). No changes to `GradeModel`, `GradesNotifier`, Firestore sync logic, `admin-ui`, or the "History" tab (`_PastGradesTab`).
- This repo (`scholar-ui11`) has a real `flutter_test` suite (11 existing test files) — write real tests, run `flutter test` to verify, per this project's established convention (unlike `admin-ui`, which has none).
- Both `add_grade_screen.dart` and `grades_screen.dart` already carry unrelated pre-existing uncommitted changes in the working tree (confirmed via `git diff --stat` before this plan was written: 331 and 896 changed lines respectively). Stage and commit ONLY the lines this plan's tasks describe — verify with `git diff --cached` before committing that no unrelated hunk was swept in. If a blanket `git add <file>` would include unrelated content, use `git add -p` or a hand-built patch (`git apply --cached`) to isolate just this plan's change.

---

### Task 1: Remove Grade/Remarks from the Add Subject form

**Files:**
- Modify: `scholar-ui11/lib/features/grades/screens/add_grade_screen.dart`
- Test: `scholar-ui11/test/features/grades/screens/add_grade_screen_test.dart` (new)

**Interfaces:**
- Consumes: `currentStudentProvider` (`Provider<StudentModel?>`, from `iskonnectttt/features/auth/providers/auth_provider.dart`), `activeAcademicPeriodProvider` (`StreamProvider<ActiveAcademicPeriod>`) and `ActiveAcademicPeriod(String schoolYear, String semester)` (both from `iskonnectttt/features/grades/providers/grades_provider.dart`) — all pre-existing, unchanged.
- Produces: no new public interface. `GradeModel` instances created by this screen now always have `grade: null, remarks: null` at creation time.

- [ ] **Step 1: Write the failing widget test**

Create `scholar-ui11/test/features/grades/screens/add_grade_screen_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/grades/providers/grades_provider.dart';
import 'package:iskonnectttt/features/grades/screens/add_grade_screen.dart';

Future<void> _pumpAddSubjectScreen(WidgetTester tester) {
  return tester.pumpWidget(
    ProviderScope(
      overrides: [
        currentStudentProvider.overrideWithValue(null),
        activeAcademicPeriodProvider.overrideWith(
          (ref) => Stream.value(
            const ActiveAcademicPeriod('2025-2026', '1st Semester'),
          ),
        ),
      ],
      child: const MaterialApp(home: AddGradeScreen()),
    ),
  );
}

void main() {
  testWidgets('Add Subject form has no Grade or Remarks fields', (tester) async {
    await _pumpAddSubjectScreen(tester);
    await tester.pumpAndSettle();

    expect(find.text('Course Code'), findsOneWidget);
    expect(find.text('Course Name'), findsOneWidget);
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

  testWidgets('submitting Course Code + Course Name succeeds without a grade', (
    tester,
  ) async {
    await _pumpAddSubjectScreen(tester);
    await tester.pumpAndSettle();

    final textFields = find.byType(TextFormField);
    expect(textFields, findsNWidgets(2)); // Course Code, Course Name only

    await tester.enterText(textFields.at(0), 'IT101');
    await tester.enterText(textFields.at(1), 'Introduction to Computing');
    await tester.tap(find.text('Add Subject'));
    await tester.pumpAndSettle();

    expect(find.text('Subject Added'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `scholar-ui11/`): `flutter test test/features/grades/screens/add_grade_screen_test.dart`
Expected: FAIL on the first test — `find.text('Grade')` finds a widget (the Grade field still exists), and/or `find.text('Remarks')` finds a widget, and/or the banner-text expectation doesn't match the current "A grade is required to submit." copy. The second test may also fail (`findsNWidgets(2)` sees 3 `TextFormField`s, since Grade's `CustomTextField` is still present).

- [ ] **Step 3: Remove the Grade/Remarks state fields**

In `scholar-ui11/lib/features/grades/screens/add_grade_screen.dart`, find:

```dart
class _AddGradeScreenState extends ConsumerState<AddGradeScreen> {
  final _formKey = GlobalKey<FormState>();
  final _subjectCodeController = TextEditingController();
  final _subjectNameController = TextEditingController();
  final _gradeController = TextEditingController();
  String _selectedSemester = '1st Semester';
  String _selectedAcademicYear = '2025-2026';
  int _selectedUnits = 3;
  String _selectedRemarks = 'Passed';
  bool _isLoading = false;

  final List<int> _units = [1, 2, 3, 4, 5, 6];
  final List<String> _remarksOptions = [
    'Passed',
    'Failed',
    'Incomplete',
    'Other',
  ];
```

Replace with:

```dart
class _AddGradeScreenState extends ConsumerState<AddGradeScreen> {
  final _formKey = GlobalKey<FormState>();
  final _subjectCodeController = TextEditingController();
  final _subjectNameController = TextEditingController();
  String _selectedSemester = '1st Semester';
  String _selectedAcademicYear = '2025-2026';
  int _selectedUnits = 3;
  bool _isLoading = false;

  final List<int> _units = [1, 2, 3, 4, 5, 6];
```

- [ ] **Step 4: Remove the Grade controller's dispose call**

Find:

```dart
  @override
  void dispose() {
    _subjectCodeController.dispose();
    _subjectNameController.dispose();
    _gradeController.dispose();
    super.dispose();
  }
```

Replace with:

```dart
  @override
  void dispose() {
    _subjectCodeController.dispose();
    _subjectNameController.dispose();
    super.dispose();
  }
```

- [ ] **Step 5: Stop parsing/sending a grade on submit**

Find the full `_handleSubmit` method:

```dart
  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final gradeText = _gradeController.text.trim();
    final parsedGrade = double.tryParse(gradeText);

    setState(() => _isLoading = true);

    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 800));

    ref
        .read(gradesProvider.notifier)
        .addGrade(
          GradeModel(
            id: const Uuid().v4(),
            subjectCode: _subjectCodeController.text.trim().toUpperCase(),
            subjectName: _subjectNameController.text.trim(),
            semester: _selectedSemester,
            academicYear: _selectedAcademicYear,
            units: _selectedUnits,
            grade: parsedGrade,
            remarks: _selectedRemarks,
          ),
        );

    setState(() => _isLoading = false);

    if (mounted) {
      DialogHelper.showSuccessDialog(
        context: context,
        title: 'Subject Added',
        message:
            'Your subject ${_subjectCodeController.text.toUpperCase()} has been recorded.',
        onPressed: () => context.pop(),
      );
    }
  }
```

Replace with:

```dart
  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 800));

    ref
        .read(gradesProvider.notifier)
        .addGrade(
          GradeModel(
            id: const Uuid().v4(),
            subjectCode: _subjectCodeController.text.trim().toUpperCase(),
            subjectName: _subjectNameController.text.trim(),
            semester: _selectedSemester,
            academicYear: _selectedAcademicYear,
            units: _selectedUnits,
            grade: null,
            remarks: null,
          ),
        );

    setState(() => _isLoading = false);

    if (mounted) {
      DialogHelper.showSuccessDialog(
        context: context,
        title: 'Subject Added',
        message:
            'Your subject ${_subjectCodeController.text.toUpperCase()} has been recorded.',
        onPressed: () => context.pop(),
      );
    }
  }
```

- [ ] **Step 6: Remove the Grade field and Remarks dropdown from the form, update the banner text**

Find the "Subject Info Section" block inside `build()`:

```dart
              if (!widget.corOnly && !widget.cogOnly) ...[
                // Subject Info Section
                const Text(
                  'Subject Information',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: _subjectCodeController,
                  label: 'Course Code',
                  hint: 'e.g., IT 101',
                  prefixIcon: Icons.code,
                  validator: Validators.required,
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: _subjectNameController,
                  label: 'Course Name',
                  hint: 'e.g., Introduction to Computing',
                  prefixIcon: Icons.book,
                  validator: Validators.required,
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: _gradeController,
                  label: 'Grade',
                  prefixIcon: Icons.grade_outlined,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Grade is required';
                    if (double.tryParse(v.trim()) == null) return 'Enter a valid numeric grade';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                CustomDropdown<int>(
                  label: 'Units',
                  value: _selectedUnits,
                  items: _units
                      .map(
                        (u) => DropdownMenuItem(
                          value: u,
                          child: Text('$u ${u == 1 ? 'unit' : 'units'}'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    setState(() => _selectedUnits = value ?? _selectedUnits);
                  },
                ),
                const SizedBox(height: 16),
                CustomDropdown<String>(
                  label: 'Remarks',
                  value: _selectedRemarks,
                  items: _remarksOptions
                      .map(
                        (r) => DropdownMenuItem(value: r, child: Text(r)),
                      )
                      .toList(),
                  onChanged: (value) {
                    setState(() => _selectedRemarks = value ?? _selectedRemarks);
                  },
                ),
                const SizedBox(height: 32),
                const Divider(),
                const SizedBox(height: 24),
              ],
```

Replace with:

```dart
              if (!widget.corOnly && !widget.cogOnly) ...[
                // Subject Info Section
                const Text(
                  'Subject Information',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: _subjectCodeController,
                  label: 'Course Code',
                  hint: 'e.g., IT 101',
                  prefixIcon: Icons.code,
                  validator: Validators.required,
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: _subjectNameController,
                  label: 'Course Name',
                  hint: 'e.g., Introduction to Computing',
                  prefixIcon: Icons.book,
                  validator: Validators.required,
                ),
                const SizedBox(height: 16),
                CustomDropdown<int>(
                  label: 'Units',
                  value: _selectedUnits,
                  items: _units
                      .map(
                        (u) => DropdownMenuItem(
                          value: u,
                          child: Text('$u ${u == 1 ? 'unit' : 'units'}'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    setState(() => _selectedUnits = value ?? _selectedUnits);
                  },
                ),
                const SizedBox(height: 32),
                const Divider(),
                const SizedBox(height: 24),
              ],
```

Then find the info banner text:

```dart
                    Expanded(
                      child: Text(
                        widget.cogOnly
                            ? 'Upload your Certificate of Grades for the selected semester.'
                            : widget.corOnly
                                ? 'Upload your Certificate of Registration for the selected semester.'
                                : 'Add your subject details. A grade is required to submit.',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.info,
                        ),
                      ),
                    ),
```

Replace the last string only:

```dart
                    Expanded(
                      child: Text(
                        widget.cogOnly
                            ? 'Upload your Certificate of Grades for the selected semester.'
                            : widget.corOnly
                                ? 'Upload your Certificate of Registration for the selected semester.'
                                : "Add your subject details. You can input the grade once it's released.",
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.info,
                        ),
                      ),
                    ),
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `flutter test test/features/grades/screens/add_grade_screen_test.dart`
Expected: PASS (2/2).

- [ ] **Step 8: Run the full suite to check for regressions**

Run: `flutter test`
Expected: all tests pass (same pass count as before this task, plus these 2 new ones).

- [ ] **Step 9: Commit**

```bash
git add scholar-ui11/lib/features/grades/screens/add_grade_screen.dart scholar-ui11/test/features/grades/screens/add_grade_screen_test.dart
git commit -m "feat: remove grade/remarks from Add Subject form"
```

If `git diff --cached scholar-ui11/lib/features/grades/screens/add_grade_screen.dart` shows anything beyond this task's changes (this file has pre-existing unrelated uncommitted content per Global Constraints), unstage and re-stage with `git add -p` to include only the hunks from Steps 3-6, then commit.

---

### Task 2: Grade-aware subject action button

**Files:**
- Modify: `scholar-ui11/lib/features/grades/screens/grades_screen.dart`
- Test: `scholar-ui11/test/features/grades/screens/grades_screen_test.dart` (new)

**Interfaces:**
- Consumes: `GradeModel` (`iskonnectttt/core/models/grade_model.dart`, unchanged), `AppColors` (`iskonnectttt/core/theme/app_theme.dart`, unchanged: uses existing `warning`, `warningLight`, `info`, `infoLight`).
- Produces: `class SubjectActionButtonStyle { final String label; final IconData icon; final Color foreground; final Color background; }` and `SubjectActionButtonStyle subjectActionButtonStyle(GradeModel grade)`, both top-level in `grades_screen.dart` — a pure function with no widget/BuildContext dependency, callable directly from a plain (non-widget) test.

- [ ] **Step 1: Write the failing unit test**

Create `scholar-ui11/test/features/grades/screens/grades_screen_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/models/grade_model.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/features/grades/screens/grades_screen.dart';

GradeModel _buildGrade({double? grade}) {
  return GradeModel(
    id: 'g1',
    subjectName: 'Intro to Computing',
    subjectCode: 'IT101',
    semester: '1st Semester',
    academicYear: '2025-2026',
    grade: grade,
  );
}

void main() {
  test('ungraded subject gets the highlighted "Input Grade" action', () {
    final style = subjectActionButtonStyle(_buildGrade(grade: null));
    expect(style.label, 'Input Grade');
    expect(style.icon, Icons.grade_outlined);
    expect(style.foreground, AppColors.warning);
    expect(style.background, AppColors.warningLight);
  });

  test('graded subject gets the plain "Edit" action', () {
    final style = subjectActionButtonStyle(_buildGrade(grade: 1.5));
    expect(style.label, 'Edit');
    expect(style.icon, Icons.edit_outlined);
    expect(style.foreground, AppColors.info);
    expect(style.background, AppColors.infoLight);
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `scholar-ui11/`): `flutter test test/features/grades/screens/grades_screen_test.dart`
Expected: FAIL to compile — `subjectActionButtonStyle` is not defined in `grades_screen.dart` yet.

- [ ] **Step 3: Add `SubjectActionButtonStyle` and `subjectActionButtonStyle`**

In `scholar-ui11/lib/features/grades/screens/grades_screen.dart`, find the boundary between `_PastGradesTab` and `_SubjectCard`:

```dart
            const SizedBox(height: 6),
          ],
        );
      },
    );
  }
}

class _SubjectCard extends ConsumerWidget {
```

Replace with:

```dart
            const SizedBox(height: 6),
          ],
        );
      },
    );
  }
}

/// Label/icon/colors for a subject's action button: an ungraded subject
/// needs a grade input (highlighted so it stands out as something still to
/// do); an already graded subject just needs a lighter "Edit" affordance.
class SubjectActionButtonStyle {
  final String label;
  final IconData icon;
  final Color foreground;
  final Color background;

  const SubjectActionButtonStyle({
    required this.label,
    required this.icon,
    required this.foreground,
    required this.background,
  });
}

SubjectActionButtonStyle subjectActionButtonStyle(GradeModel grade) {
  if (grade.grade == null) {
    return const SubjectActionButtonStyle(
      label: 'Input Grade',
      icon: Icons.grade_outlined,
      foreground: AppColors.warning,
      background: AppColors.warningLight,
    );
  }
  return const SubjectActionButtonStyle(
    label: 'Edit',
    icon: Icons.edit_outlined,
    foreground: AppColors.info,
    background: AppColors.infoLight,
  );
}

class _SubjectCard extends ConsumerWidget {
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `flutter test test/features/grades/screens/grades_screen_test.dart`
Expected: PASS (2/2).

- [ ] **Step 5: Wire the style into `_SubjectCard`'s button**

Still in `grades_screen.dart`, find the start of `_SubjectCard.build`:

```dart
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
```

Replace with:

```dart
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final actionStyle = subjectActionButtonStyle(grade);
    return Container(
```

Then find the action button itself:

```dart
          else
            TextButton.icon(
              onPressed: () => _showEditDialog(context, ref),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                backgroundColor: AppColors.infoLight,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              icon: const Icon(
                Icons.edit_outlined,
                size: 14,
                color: AppColors.info,
              ),
              label: const Text(
                'Edit',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: AppColors.info,
                ),
              ),
            ),
```

Replace with:

```dart
          else
            TextButton.icon(
              onPressed: () => _showEditDialog(context, ref),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                backgroundColor: actionStyle.background,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              icon: Icon(
                actionStyle.icon,
                size: 14,
                color: actionStyle.foreground,
              ),
              label: Text(
                actionStyle.label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: actionStyle.foreground,
                ),
              ),
            ),
```

- [ ] **Step 6: Run the full suite to check for regressions**

Run: `flutter test`
Expected: all tests pass (same pass count as after Task 1, plus these 2 new ones).

- [ ] **Step 7: Commit**

```bash
git add scholar-ui11/lib/features/grades/screens/grades_screen.dart scholar-ui11/test/features/grades/screens/grades_screen_test.dart
git commit -m "feat: highlight ungraded subjects with an Input Grade action"
```

If `git diff --cached scholar-ui11/lib/features/grades/screens/grades_screen.dart` shows anything beyond this task's changes (this file has pre-existing unrelated uncommitted content per Global Constraints), unstage and re-stage with `git add -p` to include only the hunks from Steps 3 and 5, then commit.

---

## Final check

- [ ] Run `flutter analyze` (from `scholar-ui11/`) and confirm no new errors/warnings were introduced by these changes.
- [ ] Confirm both commits from this plan are present: `git log --oneline -2`.
