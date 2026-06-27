import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/shared/widgets/custom_button.dart';

class RegistrationSuccessScreen extends ConsumerWidget {
  const RegistrationSuccessScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final student = ref
        .read(authStateProvider.notifier)
        .getPendingRegistration();

    if (student == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.go(authState.isLoggedIn ? '/dashboard' : '/login');
      });
      return const SizedBox.shrink();
    }

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const SizedBox(height: 20),
              // Success Icon
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  gradient: AppColors.successGradient,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.success.withValues(alpha: 0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: const Icon(Icons.check, size: 50, color: Colors.white),
              ),
              const SizedBox(height: 24),
              const Text(
                'Registration Successful!',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Your registration is complete. Continue to your applicant dashboard.',
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              // Continue Button
              GradientButton(
                text: 'Go to Applicant Dashboard',
                onPressed: () async {
                  final authNotifier = ref.read(authStateProvider.notifier);
                  if (!authState.isLoggedIn) {
                    await authNotifier.loginWithStudent(student);
                  }
                  authNotifier.clearPendingRegistration();
                  if (context.mounted) {
                    context.go('/dashboard');
                  }
                },
                width: double.infinity,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
