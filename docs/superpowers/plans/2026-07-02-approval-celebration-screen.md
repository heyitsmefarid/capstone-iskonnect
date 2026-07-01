# Approval Celebration Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an applicant is approved into a scholar, show a one-time full-screen celebration (confetti + fireworks, the scholar's name, and their Total/Requirements/Economic/Examination scores) before handing off to the normal scholar dashboard — instead of today's silent UI swap.

**Architecture:** A new `/celebration` top-level route (outside the bottom-nav `ShellRoute`) that `GoRouter`'s `redirect` sends a scholar to until a Firestore-persisted `celebrationSeen` flag is set. Two admin-only score fields that were computed but never synced now reach Firestore so the Flutter app can read them.

**Tech Stack:** Flutter/Dart (`scholar-ui11`), `flutter_riverpod`, `go_router`, `flutter_animate` (already a dependency — no new packages); React (`admin-ui`) for the one data-sync fix.

## Global Constraints

- No new dependencies in `pubspec.yaml` or `package.json` — confetti/fireworks/rings are built with plain Flutter (`CustomPainter`, `TweenAnimationBuilder`) plus the existing `flutter_animate` package.
- All colors come from `AppColors` (`scholar-ui11/lib/core/theme/app_theme.dart`) — no ad-hoc hex values.
- Headline copy is exactly: `"Congratulations for being our newly City Scholar, {Name}!"` — no "named", no extra body text, no "QUALIFIED" chip.
- The hero "Total Evaluation Score" ring only renders when all three component scores (`requirementsScore`, `economicScore`, `examScore`) are present; a partial evaluation shows only the breakdown rings it has.
- `Total Evaluation Score = requirementsScore + economicScore + (examScore * 0.5)`, rounded, clamped to 0–100 (matches `admin-ui/src/pages/Applications.jsx`'s existing formula).
- `celebrationSeen` is persisted on the Firestore `users/{id}` doc (not just local `SharedPreferences`), so the celebration plays once ever, on any device.
- `/celebration` is a top-level `GoRoute`, declared outside `ShellRoute` — it must never render with the bottom nav bar.
- Spec reference: `docs/superpowers/specs/2026-07-02-approval-celebration-screen-design.md`.

## File Structure

```
admin-ui/src/context/AppContext.jsx                                   (modify)

scholar-ui11/lib/core/models/student_model.dart                       (modify)
scholar-ui11/lib/features/auth/providers/auth_provider.dart           (modify)
scholar-ui11/lib/core/router/app_router.dart                          (modify)

scholar-ui11/lib/features/celebration/widgets/score_ring.dart         (new)
scholar-ui11/lib/features/celebration/widgets/confetti_layer.dart     (new)
scholar-ui11/lib/features/celebration/widgets/firework_layer.dart     (new)
scholar-ui11/lib/features/celebration/screens/congratulations_screen.dart (new)

scholar-ui11/test/core/models/student_model_test.dart                          (new)
scholar-ui11/test/features/auth/providers/auth_provider_test.dart              (new)
scholar-ui11/test/features/celebration/widgets/score_ring_test.dart            (new)
scholar-ui11/test/features/celebration/widgets/confetti_layer_test.dart        (new)
scholar-ui11/test/features/celebration/widgets/firework_layer_test.dart        (new)
scholar-ui11/test/features/celebration/screens/congratulations_screen_test.dart (new)
scholar-ui11/test/core/router/celebration_redirect_test.dart                   (new)
```

- `admin-ui` has no test runner configured (no test script, no test files anywhere in the repo) — Task 1's verification step is a build check + manual note, not an automated test. This matches existing repo convention rather than introducing new JS test infrastructure for one function.
- Every Flutter task below has a real, runnable `flutter test`.

---

### Task 1: Sync `requirementsScore`/`economicScore` to Firestore (admin-ui)

**Files:**
- Modify: `admin-ui/src/context/AppContext.jsx:270-301` (`buildUserDocFromApplicant`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `users/{id}.requirementsScore` (number|null) and `.economicScore` (number|null) now written on every sync — Task 2 reads these field names.

- [ ] **Step 1: Make the edit**

In `admin-ui/src/context/AppContext.jsx`, find:

```js
    scholarId: applicant.scholarId ?? null,
    examScore: applicant.examScore ?? null,
    interviewStatus: applicant.interviewStatus ?? null,
```

Replace with:

```js
    scholarId: applicant.scholarId ?? null,
    examScore: applicant.examScore ?? null,
    requirementsScore: applicant.requirementsScore ?? null,
    economicScore: applicant.economicScore ?? null,
    interviewStatus: applicant.interviewStatus ?? null,
```

- [ ] **Step 2: Verify the build still succeeds**

Run: `cd admin-ui && npm run build`
Expected: build completes with no errors (same as before the edit — this is a pure addition of two object keys).

- [ ] **Step 3: Manual data check (no automated test exists for this file)**

Run `cd admin-ui && npm run dev`, open Applications, score any applicant's Requirements and Economic rubric (so `requirementsScore`/`economicScore` are non-null in the UI), then check the Firebase console for that user's `users/{id}` document and confirm both fields are now present with the same values shown on screen. Note in the PR/commit description that this was checked manually.

- [ ] **Step 4: Commit**

```bash
git add admin-ui/src/context/AppContext.jsx
git commit -m "fix: sync requirementsScore/economicScore to Firestore users doc"
```

---

### Task 2: Add evaluation score fields to `StudentModel`

**Files:**
- Modify: `scholar-ui11/lib/core/models/student_model.dart`
- Test: `scholar-ui11/test/core/models/student_model_test.dart`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - Fields: `int? requirementsScore`, `int? economicScore`, `double? examScore`, `bool celebrationSeen` (default `false`).
  - `bool get hasFullEvaluation`
  - `int? get totalEvaluationScore`
  - `copyWith({..., int? requirementsScore, int? economicScore, double? examScore, bool? celebrationSeen})`
  - `toJson()`/`fromJson()` round-trip all four.

- [ ] **Step 1: Write the failing test**

Create `scholar-ui11/test/core/models/student_model_test.dart`:

```dart
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd scholar-ui11 && flutter test test/core/models/student_model_test.dart`
Expected: FAIL — compile error, e.g. "The named parameter 'requirementsScore' isn't defined" (the fields/getters don't exist yet).

- [ ] **Step 3: Implement the fields and getters**

In `scholar-ui11/lib/core/models/student_model.dart`, apply these edits:

Field declarations — find:

```dart
  final String?
  applicationStatus; // For applicants: 'pending', 'for_exam', 'for_interview', 'approved', 'rejected'
  final String? profilePicture; // Base64 encoded profile picture or URL
```

Replace with:

```dart
  final String?
  applicationStatus; // For applicants: 'pending', 'for_exam', 'for_interview', 'approved', 'rejected'
  final String? profilePicture; // Base64 encoded profile picture or URL
  // Evaluation scores the admin records while reviewing an application —
  // synced to Firestore by admin-ui's buildUserDocFromApplicant.
  final int? requirementsScore; // 0-20
  final int? economicScore; // 0-30
  final double? examScore; // 0-100
  // Set once the approval celebration screen has played for this account, so
  // it never replays (any device — this travels with the Firestore doc).
  final bool celebrationSeen;
```

Constructor params — find:

```dart
    this.applicationStatus = 'pending', // Default application status
    this.profilePicture,
  }) : scholarshipStatus =
```

Replace with:

```dart
    this.applicationStatus = 'pending', // Default application status
    this.profilePicture,
    this.requirementsScore,
    this.economicScore,
    this.examScore,
    this.celebrationSeen = false,
  }) : scholarshipStatus =
```

Getters — find:

```dart
  /// Check if student is an applicant
  bool get isApplicant => studentType == StudentType.applicant;
```

Replace with:

```dart
  /// Check if student is an applicant
  bool get isApplicant => studentType == StudentType.applicant;

  /// True once the admin has recorded all three evaluation scores.
  bool get hasFullEvaluation =>
      requirementsScore != null && economicScore != null && examScore != null;

  /// Requirements + Economic + (Exam * 0.5), rounded and clamped to 0-100 —
  /// matches the formula admin-ui's Applications.jsx already uses. Null until
  /// [hasFullEvaluation] is true, since a partial total would be misleading.
  int? get totalEvaluationScore {
    if (!hasFullEvaluation) return null;
    final total = requirementsScore! + economicScore! + (examScore! * 0.5);
    return total.round().clamp(0, 100);
  }
```

`copyWith` signature — find:

```dart
    StudentType? studentType,
    String? applicationStatus,
    String? profilePicture,
  }) {
    return StudentModel(
```

Replace with:

```dart
    StudentType? studentType,
    String? applicationStatus,
    String? profilePicture,
    int? requirementsScore,
    int? economicScore,
    double? examScore,
    bool? celebrationSeen,
  }) {
    return StudentModel(
```

`copyWith` body — find:

```dart
      studentType: studentType ?? this.studentType,
      applicationStatus: applicationStatus ?? this.applicationStatus,
      profilePicture: profilePicture ?? this.profilePicture,
    );
  }
```

Replace with:

```dart
      studentType: studentType ?? this.studentType,
      applicationStatus: applicationStatus ?? this.applicationStatus,
      profilePicture: profilePicture ?? this.profilePicture,
      requirementsScore: requirementsScore ?? this.requirementsScore,
      economicScore: economicScore ?? this.economicScore,
      examScore: examScore ?? this.examScore,
      celebrationSeen: celebrationSeen ?? this.celebrationSeen,
    );
  }
```

`toJson` — find:

```dart
      'studentType': studentType.name,
      'applicationStatus': applicationStatus,
      'profilePicture': profilePicture,
    };
  }
```

Replace with:

```dart
      'studentType': studentType.name,
      'applicationStatus': applicationStatus,
      'profilePicture': profilePicture,
      'requirementsScore': requirementsScore,
      'economicScore': economicScore,
      'examScore': examScore,
      'celebrationSeen': celebrationSeen,
    };
  }
```

`fromJson` — find:

```dart
      applicationStatus: json['applicationStatus']?.toString() ?? 'pending',
      profilePicture: json['profilePicture']?.toString(),
    );
  }
}
```

Replace with:

```dart
      applicationStatus: json['applicationStatus']?.toString() ?? 'pending',
      profilePicture: json['profilePicture']?.toString(),
      requirementsScore: (json['requirementsScore'] as num?)?.toInt(),
      economicScore: (json['economicScore'] as num?)?.toInt(),
      examScore: (json['examScore'] as num?)?.toDouble(),
      celebrationSeen: json['celebrationSeen'] == true,
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd scholar-ui11 && flutter test test/core/models/student_model_test.dart`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scholar-ui11/lib/core/models/student_model.dart scholar-ui11/test/core/models/student_model_test.dart
git commit -m "feat: add evaluation score fields and celebrationSeen to StudentModel"
```

---

### Task 3: Add `AuthNotifier.markCelebrationSeen()`

**Files:**
- Modify: `scholar-ui11/lib/features/auth/providers/auth_provider.dart`
- Test: `scholar-ui11/test/features/auth/providers/auth_provider_test.dart`

**Interfaces:**
- Consumes: `StudentModel.copyWith(celebrationSeen: true)` (Task 2).
- Produces: `AuthNotifier.markCelebrationSeen() -> Future<void>`, called as `ref.read(authStateProvider.notifier).markCelebrationSeen()`.

- [ ] **Step 1: Write the failing test**

Create `scholar-ui11/test/features/auth/providers/auth_provider_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:iskonnectttt/core/models/student_model.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';

StudentModel _buildScholar() {
  return StudentModel(
    firstName: 'Ana',
    middleName: '',
    lastName: 'Cruz',
    street: 'Rizal St',
    barangay: 'Poblacion',
    city: 'Calapan',
    province: 'Oriental Mindoro',
    gender: 'Female',
    dateOfBirth: DateTime(2002, 5, 10),
    contactNumber: '09171234567',
    email: 'ana.cruz@example.com',
    password: 'secret123',
    schoolName: 'Mindoro State University',
    yearLevel: '2',
    academicProgram: 'BS Information Technology',
    academicYear: '2025-2026',
    semester: '1st Semester',
    studentType: StudentType.scholar,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('markCelebrationSeen flips celebrationSeen to true for the logged-in student', () async {
    SharedPreferences.setMockInitialValues({});
    final notifier = AuthNotifier();
    final student = _buildScholar();

    await notifier.loginWithStudent(student);
    expect(notifier.state.student?.celebrationSeen, isFalse);

    await notifier.markCelebrationSeen();

    expect(notifier.state.student?.celebrationSeen, isTrue);
  });

  test('markCelebrationSeen is a no-op when no student is logged in', () async {
    SharedPreferences.setMockInitialValues({});
    final notifier = AuthNotifier();

    await notifier.markCelebrationSeen();

    expect(notifier.state.student, isNull);
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd scholar-ui11 && flutter test test/features/auth/providers/auth_provider_test.dart`
Expected: FAIL — "The method 'markCelebrationSeen' isn't defined for the class 'AuthNotifier'".

- [ ] **Step 3: Implement `markCelebrationSeen`**

In `scholar-ui11/lib/features/auth/providers/auth_provider.dart`, find:

```dart
  /// Persist submitted scholarship requirements to Firestore so the admin
  /// panel can see which documents the applicant has submitted.
  Future<void> saveApplicationRequirements(
```

Insert immediately before it:

```dart
  /// Marks the one-time approval celebration as seen for the current
  /// student, persisting to Firestore so it never replays on another device
  /// or after a reinstall.
  Future<void> markCelebrationSeen() async {
    if (state.student == null) return;

    final updated = state.student!.copyWith(celebrationSeen: true);
    state = state.copyWith(student: updated);
    _registeredStudents[updated.id] = updated;
    await _saveStudentsToStorage();
    await _saveStudentToFirestoreSafely(updated);
  }

```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd scholar-ui11 && flutter test test/features/auth/providers/auth_provider_test.dart`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scholar-ui11/lib/features/auth/providers/auth_provider.dart scholar-ui11/test/features/auth/providers/auth_provider_test.dart
git commit -m "feat: add AuthNotifier.markCelebrationSeen"
```

---

### Task 4: `ScoreRing` widget

**Files:**
- Create: `scholar-ui11/lib/features/celebration/widgets/score_ring.dart`
- Test: `scholar-ui11/test/features/celebration/widgets/score_ring_test.dart`

**Interfaces:**
- Consumes: `AppColors` (existing).
- Produces: `ScoreRing({required int value, required int max, required String label, double diameter = 66})` widget.

- [ ] **Step 1: Write the failing test**

Create `scholar-ui11/test/features/celebration/widgets/score_ring_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/features/celebration/widgets/score_ring.dart';

void main() {
  testWidgets('ScoreRing animates fill and count-up to the target value', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: ScoreRing(value: 18, max: 20, label: 'REQUIREMENTS'),
        ),
      ),
    );

    // At the very start of the fill animation it hasn't reached the target.
    await tester.pump();
    expect(find.text('18/20'), findsNothing);

    // After the default fill duration it settles on the target value.
    await tester.pump(const Duration(milliseconds: 1100));
    expect(find.text('18/20'), findsOneWidget);
    expect(find.text('REQUIREMENTS'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd scholar-ui11 && flutter test test/features/celebration/widgets/score_ring_test.dart`
Expected: FAIL — "Target of URI doesn't exist: 'package:iskonnectttt/features/celebration/widgets/score_ring.dart'".

- [ ] **Step 3: Implement `ScoreRing`**

Create `scholar-ui11/lib/features/celebration/widgets/score_ring.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';

/// An animated ring that fills from 0 to [value]/[max] and counts the
/// number up at the same time. Used both for the hero Total Evaluation
/// Score (larger [diameter]) and the three breakdown scores on the
/// congratulations screen.
class ScoreRing extends StatelessWidget {
  final int value;
  final int max;
  final String label;
  final double diameter;
  final Duration fillDuration;

  const ScoreRing({
    super.key,
    required this.value,
    required this.max,
    required this.label,
    this.diameter = 66,
    this.fillDuration = const Duration(milliseconds: 1100),
  });

  @override
  Widget build(BuildContext context) {
    final target = max == 0 ? 0.0 : (value / max).clamp(0.0, 1.0);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: target),
          duration: fillDuration,
          curve: Curves.easeOutCubic,
          builder: (context, progress, child) {
            final shown = (progress * value).round();
            return SizedBox(
              width: diameter,
              height: diameter,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CircularProgressIndicator(
                    value: progress,
                    strokeWidth: 6,
                    backgroundColor: AppColors.surfaceVariant,
                    valueColor: const AlwaysStoppedAnimation(AppColors.success),
                  ),
                  Text(
                    '$shown/$max',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 12.5,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
        const SizedBox(height: 6),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 9.5,
            fontWeight: FontWeight.w700,
            color: AppColors.textSecondary,
            letterSpacing: .3,
          ),
        ),
      ],
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd scholar-ui11 && flutter test test/features/celebration/widgets/score_ring_test.dart`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add scholar-ui11/lib/features/celebration/widgets/score_ring.dart scholar-ui11/test/features/celebration/widgets/score_ring_test.dart
git commit -m "feat: add ScoreRing widget for the celebration screen"
```

---

### Task 5: `ConfettiLayer` widget

**Files:**
- Create: `scholar-ui11/lib/features/celebration/widgets/confetti_layer.dart`
- Test: `scholar-ui11/test/features/celebration/widgets/confetti_layer_test.dart`

**Interfaces:**
- Consumes: `AppColors` (existing).
- Produces: `ConfettiLayer({int pieceCount = 26})` widget.

- [ ] **Step 1: Write the failing test**

Create `scholar-ui11/test/features/celebration/widgets/confetti_layer_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/features/celebration/widgets/confetti_layer.dart';

void main() {
  testWidgets('ConfettiLayer builds and animates continuously without throwing', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: ConfettiLayer()),
      ),
    );

    expect(find.byType(ConfettiLayer), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pump(const Duration(seconds: 2));
    expect(tester.takeException(), isNull);

    // Crosses the loop boundary (default cycle is 5s) — should wrap cleanly.
    await tester.pump(const Duration(seconds: 4));
    expect(tester.takeException(), isNull);
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd scholar-ui11 && flutter test test/features/celebration/widgets/confetti_layer_test.dart`
Expected: FAIL — "Target of URI doesn't exist: 'package:iskonnectttt/features/celebration/widgets/confetti_layer.dart'".

- [ ] **Step 3: Implement `ConfettiLayer`**

Create `scholar-ui11/lib/features/celebration/widgets/confetti_layer.dart`:

```dart
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';

class _ConfettiPiece {
  final double startX; // 0..1 fraction of layer width
  final double phase; // 0..1 offset into the fall cycle
  final double size;
  final double spinTurns;
  final bool isCircle;
  final Color color;

  const _ConfettiPiece({
    required this.startX,
    required this.phase,
    required this.size,
    required this.spinTurns,
    required this.isCircle,
    required this.color,
  });
}

/// Continuously falling confetti behind the celebration content. Driven by a
/// single repeating [AnimationController] with a fixed seed, so it's cheap
/// and fully deterministic (important for widget tests, which advance time
/// in fixed steps rather than real wall-clock ticks).
class ConfettiLayer extends StatefulWidget {
  final int pieceCount;

  const ConfettiLayer({super.key, this.pieceCount = 26});

  @override
  State<ConfettiLayer> createState() => _ConfettiLayerState();
}

class _ConfettiLayerState extends State<ConfettiLayer>
    with SingleTickerProviderStateMixin {
  static const _palette = [
    AppColors.primary,
    AppColors.secondary,
    AppColors.success,
    AppColors.teal,
    AppColors.mustard,
  ];

  late final AnimationController _controller;
  late final List<_ConfettiPiece> _pieces;

  @override
  void initState() {
    super.initState();
    final random = Random(7); // fixed seed: stable, deterministic layout
    _pieces = List.generate(widget.pieceCount, (i) {
      return _ConfettiPiece(
        startX: random.nextDouble(),
        phase: random.nextDouble(),
        size: 5 + random.nextDouble() * 5,
        spinTurns: 1 + random.nextDouble() * 2,
        isCircle: random.nextBool(),
        color: _palette[i % _palette.length],
      );
    });
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 5))
      ..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => CustomPaint(
          painter: _ConfettiPainter(pieces: _pieces, t: _controller.value),
          size: Size.infinite,
        ),
      ),
    );
  }
}

class _ConfettiPainter extends CustomPainter {
  final List<_ConfettiPiece> pieces;
  final double t; // 0..1, current animation value

  _ConfettiPainter({required this.pieces, required this.t});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    for (final p in pieces) {
      final localT = (t + p.phase) % 1.0;
      final y = localT * (size.height + p.size * 2) - p.size;
      final x = p.startX * size.width + sin(localT * 4 * pi) * 10;
      final angle = localT * p.spinTurns * 2 * pi;

      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(angle);
      paint.color = p.color;
      if (p.isCircle) {
        canvas.drawCircle(Offset.zero, p.size / 2, paint);
      } else {
        canvas.drawRect(
          Rect.fromCenter(center: Offset.zero, width: p.size, height: p.size * 1.6),
          paint,
        );
      }
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter oldDelegate) => oldDelegate.t != t;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd scholar-ui11 && flutter test test/features/celebration/widgets/confetti_layer_test.dart`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add scholar-ui11/lib/features/celebration/widgets/confetti_layer.dart scholar-ui11/test/features/celebration/widgets/confetti_layer_test.dart
git commit -m "feat: add ConfettiLayer widget for the celebration screen"
```

---

### Task 6: `FireworkLayer` widget

**Files:**
- Create: `scholar-ui11/lib/features/celebration/widgets/firework_layer.dart`
- Test: `scholar-ui11/test/features/celebration/widgets/firework_layer_test.dart`

**Interfaces:**
- Consumes: `AppColors` (existing).
- Produces: `FireworkLayer()` widget (no params).

- [ ] **Step 1: Write the failing test**

Create `scholar-ui11/test/features/celebration/widgets/firework_layer_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/features/celebration/widgets/firework_layer.dart';

void main() {
  testWidgets('FireworkLayer builds and paints across a full burst cycle without throwing', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: FireworkLayer()),
      ),
    );

    expect(tester.takeException(), isNull);

    // Step through an entire 3.6s cycle in 600ms increments.
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 600));
      expect(tester.takeException(), isNull);
    }
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd scholar-ui11 && flutter test test/features/celebration/widgets/firework_layer_test.dart`
Expected: FAIL — "Target of URI doesn't exist: 'package:iskonnectttt/features/celebration/widgets/firework_layer.dart'".

- [ ] **Step 3: Implement `FireworkLayer`**

Create `scholar-ui11/lib/features/celebration/widgets/firework_layer.dart`:

```dart
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';

class _BurstSpec {
  final double startFraction; // 0..1, when in the cycle this burst starts
  final Offset origin; // fractional position within the layer (0..1, 0..1)
  final Color color;

  const _BurstSpec({
    required this.startFraction,
    required this.origin,
    required this.color,
  });
}

/// A handful of firework bursts that repeat on a loop: each rises briefly
/// then radiates outward and fades — purely decorative background motion for
/// the celebration screen. Driven by one repeating [AnimationController], so
/// it's cheap and fully deterministic (no `Timer`s, no wall-clock reliance).
class FireworkLayer extends StatefulWidget {
  const FireworkLayer({super.key});

  @override
  State<FireworkLayer> createState() => _FireworkLayerState();
}

class _FireworkLayerState extends State<FireworkLayer>
    with SingleTickerProviderStateMixin {
  static const _cycleDuration = Duration(milliseconds: 3600);
  static const _riseFraction = 0.10; // fraction of the cycle spent rising
  static const _burstFraction = 0.28; // fraction of the cycle spent radiating

  static const _bursts = [
    _BurstSpec(startFraction: 0.00, origin: Offset(0.22, 0.30), color: AppColors.mustard),
    _BurstSpec(startFraction: 0.15, origin: Offset(0.72, 0.22), color: AppColors.success),
    _BurstSpec(startFraction: 0.32, origin: Offset(0.45, 0.38), color: AppColors.primary),
    _BurstSpec(startFraction: 0.50, origin: Offset(0.82, 0.42), color: AppColors.secondaryDark),
    _BurstSpec(startFraction: 0.68, origin: Offset(0.30, 0.20), color: AppColors.success),
  ];

  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: _cycleDuration)
      ..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => CustomPaint(
          painter: _FireworkPainter(
            bursts: _bursts,
            t: _controller.value,
            riseFraction: _riseFraction,
            burstFraction: _burstFraction,
          ),
          size: Size.infinite,
        ),
      ),
    );
  }
}

class _FireworkPainter extends CustomPainter {
  final List<_BurstSpec> bursts;
  final double t; // 0..1 within the current cycle
  final double riseFraction;
  final double burstFraction;

  _FireworkPainter({
    required this.bursts,
    required this.t,
    required this.riseFraction,
    required this.burstFraction,
  });

  static const _particlesPerBurst = 14;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    final totalFraction = riseFraction + burstFraction;

    for (final burst in bursts) {
      final localT = (t - burst.startFraction) % 1.0;
      if (localT > totalFraction) continue; // not active right now

      final center = Offset(burst.origin.dx * size.width, burst.origin.dy * size.height);

      if (localT < riseFraction) {
        final riseT = riseFraction == 0 ? 1.0 : localT / riseFraction;
        final start = Offset(center.dx, size.height + 12);
        final pos = Offset.lerp(start, center, riseT)!;
        paint.color = burst.color;
        canvas.drawCircle(pos, 2.4, paint);
      } else {
        final burstT = (localT - riseFraction) / burstFraction;
        final radius = 8 + burstT * 40;
        final opacity = (1 - burstT).clamp(0.0, 1.0);
        paint.color = burst.color.withValues(alpha: opacity);
        for (var i = 0; i < _particlesPerBurst; i++) {
          final angle = (2 * pi * i) / _particlesPerBurst;
          final offset = center + Offset(cos(angle), sin(angle)) * radius;
          canvas.drawCircle(offset, 2.5, paint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _FireworkPainter oldDelegate) => oldDelegate.t != t;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd scholar-ui11 && flutter test test/features/celebration/widgets/firework_layer_test.dart`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add scholar-ui11/lib/features/celebration/widgets/firework_layer.dart scholar-ui11/test/features/celebration/widgets/firework_layer_test.dart
git commit -m "feat: add FireworkLayer widget for the celebration screen"
```

---

### Task 7: `CongratulationsScreen`

**Files:**
- Create: `scholar-ui11/lib/features/celebration/screens/congratulations_screen.dart`
- Test: `scholar-ui11/test/features/celebration/screens/congratulations_screen_test.dart`

**Interfaces:**
- Consumes:
  - `ScoreRing` (Task 4), `ConfettiLayer` (Task 5), `FireworkLayer` (Task 6).
  - `StudentModel.fullName`, `.hasFullEvaluation`, `.totalEvaluationScore`, `.requirementsScore`, `.economicScore`, `.examScore` (Task 2).
  - `currentStudentProvider` (existing, `auth_provider.dart`).
  - `authStateProvider.notifier.markCelebrationSeen()` (Task 3).
- Produces: `CongratulationsScreen({Future<void> Function(WidgetRef ref)? onFinished})` widget — `onFinished` overrides the real "mark seen + navigate" action for testability; Task 8 uses the default (real) behavior.

- [ ] **Step 1: Write the failing test**

Create `scholar-ui11/test/features/celebration/screens/congratulations_screen_test.dart`:

```dart
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
    await tester.pump();

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
    await tester.pump();

    expect(find.textContaining('Maria Santos'), findsNothing);
    expect(find.text('YOUR EVALUATION RESULTS'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 900)); // Continue button appears
    expect(find.text('Continue'), findsOneWidget);

    await tester.tap(find.text('Continue'));
    await tester.pump();

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
    await tester.pump();

    expect(find.text('YOUR EVALUATION RESULTS'), findsNothing);
    expect(find.textContaining('Maria Santos'), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd scholar-ui11 && flutter test test/features/celebration/screens/congratulations_screen_test.dart`
Expected: FAIL — "Target of URI doesn't exist: 'package:iskonnectttt/features/celebration/screens/congratulations_screen.dart'".

- [ ] **Step 3: Implement `CongratulationsScreen`**

Create `scholar-ui11/lib/features/celebration/screens/congratulations_screen.dart`:

```dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:iskonnectttt/core/models/student_model.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/celebration/widgets/confetti_layer.dart';
import 'package:iskonnectttt/features/celebration/widgets/firework_layer.dart';
import 'package:iskonnectttt/features/celebration/widgets/score_ring.dart';

/// One-time full-screen celebration shown right after an applicant is
/// approved into a scholar, before they land on the normal scholar
/// dashboard. See
/// docs/superpowers/specs/2026-07-02-approval-celebration-screen-design.md.
class CongratulationsScreen extends ConsumerStatefulWidget {
  /// Overridable for tests: replaces the real "mark seen + navigate" action.
  final Future<void> Function(WidgetRef ref)? onFinished;

  const CongratulationsScreen({super.key, this.onFinished});

  @override
  ConsumerState<CongratulationsScreen> createState() => _CongratulationsScreenState();
}

class _CongratulationsScreenState extends ConsumerState<CongratulationsScreen> {
  static const _phase1Duration = Duration(milliseconds: 2800);
  static const _ringStagger = Duration(milliseconds: 300);
  static const _autoAdvanceBuffer = Duration(milliseconds: 2500);

  bool _showScores = false;
  bool _showContinue = false;
  bool _finished = false;
  Timer? _phaseTimer;
  Timer? _continueTimer;
  Timer? _autoAdvanceTimer;

  @override
  void initState() {
    super.initState();
    final student = ref.read(currentStudentProvider);
    final hasAnyScore = student != null &&
        (student.requirementsScore != null ||
            student.economicScore != null ||
            student.examScore != null);

    _phaseTimer = Timer(_phase1Duration, () {
      if (!mounted) return;
      if (hasAnyScore) {
        setState(() => _showScores = true);
        _continueTimer = Timer(const Duration(milliseconds: 900), () {
          if (mounted) setState(() => _showContinue = true);
        });
        _autoAdvanceTimer = Timer(_autoAdvanceBuffer, _finish);
      } else {
        setState(() => _showContinue = true);
        _autoAdvanceTimer = Timer(const Duration(milliseconds: 1800), _finish);
      }
    });
  }

  @override
  void dispose() {
    _phaseTimer?.cancel();
    _continueTimer?.cancel();
    _autoAdvanceTimer?.cancel();
    super.dispose();
  }

  Future<void> _finish() async {
    if (_finished) return;
    _finished = true;
    _phaseTimer?.cancel();
    _continueTimer?.cancel();
    _autoAdvanceTimer?.cancel();

    if (widget.onFinished != null) {
      await widget.onFinished!(ref);
      return;
    }
    await ref.read(authStateProvider.notifier).markCelebrationSeen();
    if (mounted) context.go('/dashboard');
  }

  @override
  Widget build(BuildContext context) {
    final student = ref.watch(currentStudentProvider);
    final name = student?.fullName ?? '';

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.6),
            radius: 1.2,
            colors: [AppColors.successLight, AppColors.background],
          ),
        ),
        child: SafeArea(
          child: Stack(
            children: [
              const Positioned.fill(child: ConfettiLayer()),
              const Positioned.fill(child: FireworkLayer()),
              Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 28),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (!_showScores) _buildHeadline(name),
                      if (_showScores && student != null) _buildScores(student),
                      if (_showContinue) _buildContinueButton(),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeadline(String name) {
    final text = name.isEmpty
        ? 'Congratulations for being\nour newly City Scholar!'
        : 'Congratulations for being\nour newly City Scholar,\n$name!';
    return Text(
      text,
      textAlign: TextAlign.center,
      style: const TextStyle(
        fontWeight: FontWeight.w900,
        fontSize: 26,
        height: 1.25,
        color: AppColors.primary,
      ),
    ).animate().fadeIn(duration: 500.ms).scale(
          begin: const Offset(0.7, 0.7),
          end: const Offset(1, 1),
          curve: Curves.elasticOut,
          duration: 700.ms,
        );
  }

  Widget _buildScores(StudentModel student) {
    final rings = <Widget>[];
    if (student.requirementsScore != null) {
      rings.add(ScoreRing(value: student.requirementsScore!, max: 20, label: 'REQUIREMENTS'));
    }
    if (student.economicScore != null) {
      rings.add(ScoreRing(value: student.economicScore!, max: 30, label: 'ECONOMIC'));
    }
    if (student.examScore != null) {
      rings.add(ScoreRing(value: student.examScore!.round(), max: 100, label: 'EXAMINATION'));
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'YOUR EVALUATION RESULTS',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 13,
            letterSpacing: .6,
            color: AppColors.textPrimary,
          ),
        ).animate().fadeIn(duration: 400.ms),
        const SizedBox(height: 18),
        if (student.hasFullEvaluation)
          ScoreRing(
            value: student.totalEvaluationScore!,
            max: 100,
            label: 'TOTAL EVALUATION SCORE',
            diameter: 92,
          ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.2, end: 0),
        const SizedBox(height: 18),
        Wrap(
          spacing: 18,
          runSpacing: 12,
          alignment: WrapAlignment.center,
          children: [
            for (var i = 0; i < rings.length; i++)
              rings[i]
                  .animate(delay: _ringStagger * i)
                  .fadeIn(duration: 400.ms)
                  .slideY(begin: 0.2, end: 0),
          ],
        ),
      ],
    );
  }

  Widget _buildContinueButton() {
    return Padding(
      padding: const EdgeInsets.only(top: 28),
      child: ElevatedButton(
        onPressed: _finish,
        child: const Text('Continue'),
      ),
    ).animate().fadeIn(duration: 400.ms);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd scholar-ui11 && flutter test test/features/celebration/screens/congratulations_screen_test.dart`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scholar-ui11/lib/features/celebration/screens/congratulations_screen.dart scholar-ui11/test/features/celebration/screens/congratulations_screen_test.dart
git commit -m "feat: add CongratulationsScreen orchestrating the approval celebration"
```

---

### Task 8: Wire `/celebration` into the router

**Files:**
- Modify: `scholar-ui11/lib/core/router/app_router.dart`
- Test: `scholar-ui11/test/core/router/celebration_redirect_test.dart`

**Interfaces:**
- Consumes: `CongratulationsScreen` (Task 7), `StudentModel.isScholar`/`.celebrationSeen` (Task 2, existing).
- Produces: `/celebration` route; `celebrationRedirectTarget({required bool celebrationPending, required bool isCelebrating}) -> String?` (public, unit-tested pure function).

- [ ] **Step 1: Write the failing test**

Create `scholar-ui11/test/core/router/celebration_redirect_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/router/app_router.dart';

void main() {
  group('celebrationRedirectTarget', () {
    test('sends a pending scholar to /celebration', () {
      final target = celebrationRedirectTarget(celebrationPending: true, isCelebrating: false);
      expect(target, '/celebration');
    });

    test('does nothing while already on /celebration and still pending', () {
      final target = celebrationRedirectTarget(celebrationPending: true, isCelebrating: true);
      expect(target, isNull);
    });

    test('bounces back to /dashboard once acknowledged but still on /celebration', () {
      final target = celebrationRedirectTarget(celebrationPending: false, isCelebrating: true);
      expect(target, '/dashboard');
    });

    test('does nothing for a normal, non-pending route', () {
      final target = celebrationRedirectTarget(celebrationPending: false, isCelebrating: false);
      expect(target, isNull);
    });
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd scholar-ui11 && flutter test test/core/router/celebration_redirect_test.dart`
Expected: FAIL — "The function 'celebrationRedirectTarget' isn't defined".

- [ ] **Step 3: Implement the route and redirect logic**

In `scholar-ui11/lib/core/router/app_router.dart`, apply these edits:

Import — find:

```dart
import 'package:iskonnectttt/features/scholarship_application/screens/scholarship_application_screen.dart';
import 'package:iskonnectttt/shared/widgets/main_shell.dart';
```

Replace with:

```dart
import 'package:iskonnectttt/features/scholarship_application/screens/scholarship_application_screen.dart';
import 'package:iskonnectttt/features/celebration/screens/congratulations_screen.dart';
import 'package:iskonnectttt/shared/widgets/main_shell.dart';
```

New provider/notifier/pure function, plus `refreshListenable` wiring — find:

```dart
final _authStatusProvider = Provider<({bool isLoggedIn, bool isInitialized})>((
  ref,
) {
  final authState = ref.watch(authStateProvider);
  return (
    isLoggedIn: authState.isLoggedIn,
    isInitialized: authState.isInitialized,
  );
});

final appRouterProvider = Provider<GoRouter>((ref) {
  final authStatus = ref.watch(_authStatusProvider);

  return GoRouter(
    initialLocation: '/splash',
    debugLogDiagnostics: true,
    redirect: (context, state) {
```

Replace with:

```dart
final _authStatusProvider = Provider<({bool isLoggedIn, bool isInitialized})>((
  ref,
) {
  final authState = ref.watch(authStateProvider);
  return (
    isLoggedIn: authState.isLoggedIn,
    isInitialized: authState.isInitialized,
  );
});

// Narrow provider so the celebration refresh only fires on the one
// transition that matters (applicant -> scholar, or celebration
// acknowledged) — not on every grade/attendance update to the student doc.
final _celebrationStatusProvider = Provider<({bool isScholar, bool celebrationSeen})>((
  ref,
) {
  final student = ref.watch(currentStudentProvider);
  return (
    isScholar: student?.isScholar ?? false,
    celebrationSeen: student?.celebrationSeen ?? false,
  );
});

/// Pure decision used by the router's redirect callback: where (if anywhere)
/// to send the user based on celebration status. A standalone function so
/// it's unit-testable without constructing a GoRouter/ProviderScope.
String? celebrationRedirectTarget({
  required bool celebrationPending,
  required bool isCelebrating,
}) {
  if (celebrationPending && !isCelebrating) return '/celebration';
  if (!celebrationPending && isCelebrating) return '/dashboard';
  return null;
}

/// Notifies go_router to re-run `redirect` for the CURRENT location (without
/// recreating the router or losing navigation state) whenever the scholar's
/// celebration status changes — e.g. the admin approves them while they're
/// mid-session on some other screen.
class _CelebrationRefreshNotifier extends ChangeNotifier {
  late final ProviderSubscription _subscription;

  _CelebrationRefreshNotifier(Ref ref) {
    _subscription = ref.listen(_celebrationStatusProvider, (previous, next) {
      if (previous != next) notifyListeners();
    });
  }

  @override
  void dispose() {
    _subscription.close();
    super.dispose();
  }
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final authStatus = ref.watch(_authStatusProvider);
  final celebrationRefresh = _CelebrationRefreshNotifier(ref);
  ref.onDispose(celebrationRefresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    debugLogDiagnostics: true,
    refreshListenable: celebrationRefresh,
    redirect: (context, state) {
```

Redirect body tail — find:

```dart
      // If logged in and trying to access login, redirect to dashboard
      if (isLoggedIn && isLoggingIn) {
        return '/dashboard';
      }

      return null;
    },
```

Replace with:

```dart
      final celebration = ref.read(_celebrationStatusProvider);
      final celebrationPending = celebration.isScholar && !celebration.celebrationSeen;
      final isCelebrating = state.matchedLocation == '/celebration';

      // If logged in and trying to access login, redirect to dashboard (or
      // the celebration screen first, if it hasn't been seen yet).
      if (isLoggedIn && isLoggingIn) {
        return celebrationPending ? '/celebration' : '/dashboard';
      }

      return celebrationRedirectTarget(
        celebrationPending: celebrationPending,
        isCelebrating: isCelebrating,
      );
    },
```

New route — find:

```dart
      GoRoute(
        path: '/forgot-password',
        name: 'forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      ShellRoute(
```

Replace with:

```dart
      GoRoute(
        path: '/forgot-password',
        name: 'forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/celebration',
        name: 'celebration',
        builder: (context, state) => const CongratulationsScreen(),
      ),
      ShellRoute(
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd scholar-ui11 && flutter test test/core/router/celebration_redirect_test.dart`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full test suite**

Run: `cd scholar-ui11 && flutter test`
Expected: PASS (all tests from Tasks 2–8, plus the pre-existing placeholder test).

- [ ] **Step 6: Commit**

```bash
git add scholar-ui11/lib/core/router/app_router.dart scholar-ui11/test/core/router/celebration_redirect_test.dart
git commit -m "feat: route approved-but-uncelebrated scholars to /celebration"
```

---

### Task 9: Manual end-to-end verification

No new files — this closes the loop with the one thing no automated test in this repo can cover: real Firestore + real admin approval + real device behavior.

- [ ] **Step 1: Approve an applicant with a full evaluation**

In `admin-ui` (`npm run dev`), pick an applicant, set all three scores (Requirements, Economic, Exam), then approve them (status → `approved`/`active`).

- [ ] **Step 2: Watch the scholar app react live**

With that applicant already logged into the Flutter app (any screen, not just the dashboard) at the moment of approval, confirm: confetti + fireworks play, the headline shows their name, then the Total Evaluation Score ring and the three breakdown rings fill in, then it lands on the normal scholar dashboard (bottom nav visible again) — either via the Continue button or automatically.

- [ ] **Step 3: Confirm it doesn't replay**

Kill and relaunch the app (or log out/log back in) as that same scholar. Confirm it goes straight to the normal dashboard — no celebration replay.

- [ ] **Step 4: Confirm the partial-evaluation path**

Repeat Step 1 for a second applicant, but leave one score blank (e.g. no exam score) before approving. Confirm the celebration shows only the rings for the scores that exist, with no Total Evaluation Score ring.

- [ ] **Step 5: Note the results**

Record the outcome (pass/fail per step) in the PR description or commit message for this task, since this is the only verification of the full Firestore-backed flow.

---

## Self-Review Notes

- **Spec coverage:** all decisions from `docs/superpowers/specs/2026-07-02-approval-celebration-screen-design.md` map to a task — data sync (Task 1), model fields (Task 2), seen-flag persistence (Task 3), visuals (Tasks 4–6), orchestration (Task 7), routing (Task 8), and the one thing that can't be automated (Task 9).
- **Placeholder scan:** no TODOs/TBDs; every step has literal code or literal manual instructions.
- **Type consistency:** `ScoreRing({value, max, label, diameter})` is used identically in Task 7 as defined in Task 4; `celebrationRedirectTarget({celebrationPending, isCelebrating})` matches between Task 8's test and implementation; `markCelebrationSeen()` matches between Task 3 and Task 7's real (non-test) `_finish()` path.
