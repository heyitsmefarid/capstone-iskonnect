import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/celebration/widgets/confetti_layer.dart';
import 'package:iskonnectttt/features/celebration/widgets/firework_layer.dart';

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
  static const _autoAdvanceBuffer = Duration(milliseconds: 1800);

  bool _showContinue = false;
  bool _finished = false;
  Timer? _phaseTimer;
  Timer? _autoAdvanceTimer;

  @override
  void initState() {
    super.initState();
    _phaseTimer = Timer(_phase1Duration, () {
      if (!mounted) return;
      setState(() => _showContinue = true);
      _autoAdvanceTimer = Timer(_autoAdvanceBuffer, _finish);
    });
  }

  @override
  void dispose() {
    _phaseTimer?.cancel();
    _autoAdvanceTimer?.cancel();
    super.dispose();
  }

  Future<void> _finish() async {
    if (_finished) return;
    _finished = true;
    _phaseTimer?.cancel();
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
                      _buildHeadline(name),
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
