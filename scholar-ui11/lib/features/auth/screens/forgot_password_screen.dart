import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/core/utils/validators.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/shared/widgets/custom_button.dart';
import 'package:iskonnectttt/shared/widgets/custom_text_field.dart';

/// Forgot-password flow: enter your email, and Firebase Auth sends a
/// password-reset link. The new password is set on Firebase's own reset page,
/// so this screen never handles it.
///
/// The previous two-step design (emailed 6-digit code, then the app wrote the
/// new password) could not work: setting another user's password needs a reset
/// token or the Admin SDK, and its Cloud Functions endpoints were never
/// deployed. See `AuthNotifier.sendPasswordResetEmail`.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _emailFormKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();

  bool _emailSent = false;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _sendResetLink() async {
    setState(() => _error = null);
    if (!_emailFormKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    final error = await ref
        .read(authStateProvider.notifier)
        .sendPasswordResetEmail(_emailController.text.trim().toLowerCase());
    if (!mounted) return;
    setState(() {
      _submitting = false;
      if (error == null) {
        _emailSent = true;
      } else {
        _error = error;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Forgot Password',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.primaryDark, AppColors.primary],
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 12),
            Center(
              child: Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _emailSent
                      ? Icons.mark_email_read_rounded
                      : Icons.lock_reset_rounded,
                  size: 36,
                  color: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              _emailSent ? 'Check Your Email' : 'Forgot Your Password?',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _emailSent
                  ? 'If an account exists for that address, we\'ve sent it a '
                      'password-reset link. Open the link to choose a new '
                      'password, then come back and sign in.'
                  : 'Enter your account email and we\'ll send you a link to '
                      'reset your password.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),

            if (_error != null) _banner(_error!, isError: true),

            // Hidden once the link is on its way: there is nothing left to do
            // in the app, so keeping the field would invite a pointless resend.
            if (!_emailSent) ...[
              Form(
                key: _emailFormKey,
                child: CustomTextField(
                  controller: _emailController,
                  label: 'Email Address',
                  hint: 'Enter your email',
                  prefixIcon: Icons.email_outlined,
                  keyboardType: TextInputType.emailAddress,
                  validator: Validators.email,
                ),
              ),
              const SizedBox(height: 16),
              GradientButton(
                text: 'Send Reset Link',
                onPressed: _sendResetLink,
                isLoading: _submitting,
              ),
            ] else
              _banner(
                'Reset link sent to ${_emailController.text.trim().toLowerCase()}. '
                'It may take a minute to arrive — remember to check your spam folder.',
                isError: false,
              ),

            const SizedBox(height: 16),
            CustomButton(
              text: 'Back to Login',
              onPressed: () => context.go('/login'),
              isOutlined: true,
              icon: Icons.arrow_back,
            ),
          ],
        ),
      ),
    );
  }

  Widget _banner(String message, {required bool isError}) {
    final color = isError ? AppColors.error : AppColors.success;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(
            isError ? Icons.error_outline : Icons.check_circle_outline,
            color: color,
            size: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(fontSize: 13, color: color),
            ),
          ),
        ],
      ),
    );
  }
}
