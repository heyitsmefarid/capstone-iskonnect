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
        if (student.hasFullEvaluation) ...[
          const SizedBox(height: 18),
          ScoreRing(
            value: student.totalEvaluationScore!,
            max: 100,
            label: 'TOTAL EVALUATION SCORE',
            diameter: 92,
          ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.2, end: 0),
        ],
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
