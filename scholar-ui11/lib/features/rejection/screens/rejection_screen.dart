import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';

/// One-time full-screen notice shown after an applicant is rejected, before
/// they land on the normal (applicant) dashboard.
///
/// Mirrors CongratulationsScreen's one-time-notice mechanism (a `*Seen` flag
/// on StudentModel + a router redirect) for the other possible outcome of an
/// application decision — deliberately without its confetti/fireworks, which
/// would be tonally wrong here, and without an auto-advance timer, since a
/// rejection reason is worth reading at the applicant's own pace rather than
/// being swept off screen.
class RejectionScreen extends ConsumerStatefulWidget {
  /// Overridable for tests: replaces the real "mark seen + navigate" action.
  final Future<void> Function(WidgetRef ref)? onFinished;

  const RejectionScreen({super.key, this.onFinished});

  @override
  ConsumerState<RejectionScreen> createState() => _RejectionScreenState();
}

class _RejectionScreenState extends ConsumerState<RejectionScreen> {
  bool _finished = false;

  Future<void> _finish() async {
    if (_finished) return;
    _finished = true;

    if (widget.onFinished != null) {
      await widget.onFinished!(ref);
      return;
    }
    await ref.read(authStateProvider.notifier).markRejectionSeen();
    if (mounted) context.go('/dashboard');
  }

  @override
  Widget build(BuildContext context) {
    final student = ref.watch(currentStudentProvider);
    final name = student?.fullName ?? '';
    final reason = student?.rejectionReason?.trim();

    return Scaffold(
      body: Container(
        // Calm blue-gray, not the celebration screen's success-green and
        // deliberately not error-red either — this is delivering information,
        // not raising an alarm.
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.6),
            radius: 1.2,
            colors: [AppColors.infoLight, AppColors.background],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildHeadline(name),
                  if (reason != null && reason.isNotEmpty) _buildReason(reason),
                  _buildContinueButton(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeadline(String name) {
    final text = name.isEmpty
        ? "We're sorry — your application\nwas not approved this time."
        : "We're sorry, $name —\nyour application was not\napproved this time.";
    return Text(
      text,
      textAlign: TextAlign.center,
      style: const TextStyle(
        fontWeight: FontWeight.w900,
        fontSize: 22,
        height: 1.3,
        color: AppColors.textPrimary,
      ),
    ).animate().fadeIn(duration: 500.ms).slideY(begin: 0.1, end: 0);
  }

  Widget _buildReason(String reason) {
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.info.withValues(alpha: 0.25)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'REASON',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 11,
                letterSpacing: .6,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              reason,
              style: const TextStyle(
                fontSize: 14,
                height: 1.4,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    ).animate(delay: 300.ms).fadeIn(duration: 400.ms);
  }

  Widget _buildContinueButton() {
    return Padding(
      padding: const EdgeInsets.only(top: 28),
      child: ElevatedButton(
        onPressed: _finish,
        child: const Text('Continue'),
      ),
    ).animate(delay: 800.ms).fadeIn(duration: 400.ms);
  }
}
