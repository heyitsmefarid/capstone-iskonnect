import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/services/email_service.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/core/utils/validators.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/shared/widgets/custom_button.dart';
import 'package:iskonnectttt/shared/widgets/custom_text_field.dart';

/// Forgot-password flow:
///   Step 1 — enter email, request a reset code (emailed via the OTP backend).
///   Step 2 — enter the code + a new password; once the code verifies, the app
///            writes the new password to the account.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _emailFormKey = GlobalKey<FormState>();
  final _resetFormKey = GlobalKey<FormState>();

  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _codeSent = false;
  bool _submitting = false;
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _requestCode() async {
    setState(() {
      _error = null;
      _info = null;
    });
    if (!_emailFormKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    final result = await EmailService.requestPasswordReset(
      toEmail: _emailController.text.trim().toLowerCase(),
    );
    if (!mounted) return;
    setState(() {
      _submitting = false;
      if (result.success) {
        _codeSent = true;
        _info = result.message;
      } else {
        _error = result.message;
      }
    });
  }

  Future<void> _submitReset() async {
    setState(() {
      _error = null;
      _info = null;
    });
    if (!_resetFormKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    // 1) Verify the emailed code with the OTP backend.
    final verify = await EmailService.verifyCode(
      toEmail: _emailController.text.trim().toLowerCase(),
      code: _codeController.text.trim(),
    );
    if (!mounted) return;
    if (!verify.success) {
      setState(() {
        _submitting = false;
        _error = verify.message;
      });
      return;
    }

    // 2) Code is valid — set the new password on the matching account.
    final ok = await ref.read(authStateProvider.notifier).resetPasswordByEmail(
          _emailController.text.trim().toLowerCase(),
          _passwordController.text,
        );
    if (!mounted) return;
    setState(() => _submitting = false);

    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password reset successfully. Please sign in.'),
          backgroundColor: Colors.green,
        ),
      );
      context.go('/login');
    } else {
      setState(() => _error = 'No account was found for that email address.');
    }
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
                child: const Icon(
                  Icons.lock_reset_rounded,
                  size: 36,
                  color: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              _codeSent ? 'Reset Your Password' : 'Forgot Your Password?',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _codeSent
                  ? 'Enter the 6-digit code we sent to your email and choose a new password.'
                  : 'Enter your account email and we\'ll send you a reset code.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),

            if (_error != null) _banner(_error!, isError: true),
            if (_info != null) _banner(_info!, isError: false),

            // ── Step 1: request code ──────────────────────────────────────
            Form(
              key: _emailFormKey,
              child: CustomTextField(
                controller: _emailController,
                label: 'Email Address',
                hint: 'Enter your email',
                prefixIcon: Icons.email_outlined,
                keyboardType: TextInputType.emailAddress,
                validator: Validators.email,
                enabled: !_codeSent,
              ),
            ),
            const SizedBox(height: 16),

            if (!_codeSent)
              GradientButton(
                text: 'Send Reset Code',
                onPressed: _requestCode,
                isLoading: _submitting,
              ),

            // ── Step 2: enter code + new password ─────────────────────────
            if (_codeSent) ...[
              Form(
                key: _resetFormKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    CustomTextField(
                      controller: _codeController,
                      label: '6-Digit Code',
                      hint: '••••••',
                      prefixIcon: Icons.pin_outlined,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(6),
                      ],
                      validator: (v) => (v == null || v.trim().length != 6)
                          ? 'Enter the 6-digit code'
                          : null,
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: _passwordController,
                      label: 'New Password',
                      hint: 'Min 8 chars, upper, lower, number & symbol',
                      prefixIcon: Icons.lock_outline,
                      obscureText: _obscurePassword,
                      validator: Validators.strongPassword,
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                        onPressed: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    CustomTextField(
                      controller: _confirmController,
                      label: 'Confirm New Password',
                      hint: 'Re-enter your new password',
                      prefixIcon: Icons.lock_outline,
                      obscureText: _obscureConfirm,
                      validator: (v) => Validators.confirmPassword(
                        v,
                        _passwordController.text,
                      ),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscureConfirm
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                        onPressed: () =>
                            setState(() => _obscureConfirm = !_obscureConfirm),
                      ),
                    ),
                    const SizedBox(height: 20),
                    GradientButton(
                      text: 'Reset Password',
                      onPressed: _submitReset,
                      isLoading: _submitting,
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: _submitting ? null : _requestCode,
                      child: const Text('Resend Code'),
                    ),
                  ],
                ),
              ),
            ],

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
