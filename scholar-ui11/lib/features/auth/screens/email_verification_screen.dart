import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/services/email_service.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';

class EmailVerificationScreen extends StatefulWidget {
  final String email;
  const EmailVerificationScreen({super.key, required this.email});

  @override
  State<EmailVerificationScreen> createState() => _EmailVerificationScreenState();
}

class _EmailVerificationScreenState extends State<EmailVerificationScreen> {
  final List<TextEditingController> _ctrl = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focus = List.generate(6, (_) => FocusNode());

  bool _loading = false;
  bool _resending = false;
  String? _error;
  int _resendCooldown = 60;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startCooldown();
    _sendOtp();
  }

  @override
  void dispose() {
    for (final c in _ctrl) { c.dispose(); }
    for (final f in _focus) { f.dispose(); }
    _timer?.cancel();
    super.dispose();
  }

  void _startCooldown() {
    _resendCooldown = 60;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() {
        _resendCooldown--;
        if (_resendCooldown <= 0) t.cancel();
      });
    });
  }

  Future<void> _sendOtp() async {
    final result = await EmailService.sendVerificationCode(toEmail: widget.email);

    if (!mounted) return;
    setState(() {
      _error = result.success ? null : result.message;
    });
  }

  Future<void> _resend() async {
    if (_resendCooldown > 0 || _resending) return;
    setState(() { _resending = true; _error = null; });
    await _sendOtp();
    setState(() { _resending = false; });
    _startCooldown();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Verification code resent. Check your email.'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  String get _otp => _ctrl.map((c) => c.text).join();

  Future<void> _verify() async {
    final otp = _otp;
    if (otp.length < 6) {
      setState(() => _error = 'Please enter all 6 digits.');
      return;
    }

    setState(() { _loading = true; _error = null; });

    final result = await EmailService.verifyCode(toEmail: widget.email, code: otp);

    if (!mounted) return;

    if (!result.success) {
      setState(() {
        _loading = false;
        _error = result.message;
      });
      return;
    }

    setState(() => _loading = false);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Email verified successfully!'),
        backgroundColor: Colors.green,
        duration: Duration(seconds: 2),
      ),
    );
    await Future.delayed(const Duration(seconds: 1));
    if (mounted) context.go('/dashboard');
  }

  void _onDigitChanged(int index, String value) {
    if (value.length == 6) {
      // Handle paste of full OTP
      for (int i = 0; i < 6 && i < value.length; i++) {
        _ctrl[i].text = value[i];
      }
      _focus[5].requestFocus();
      setState(() {});
      return;
    }
    if (value.isNotEmpty && index < 5) {
      _focus[index + 1].requestFocus();
    }
    setState(() {});
  }

  // Backspace navigation handled via onChanged (empty value = move back)

  @override
  Widget build(BuildContext context) {
    final maskedEmail = _maskEmail(widget.email);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text('Email Verification', style: TextStyle(fontWeight: FontWeight.w700)),
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
        padding: const EdgeInsets.all(28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const SizedBox(height: 24),
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.mark_email_read_rounded, size: 40, color: AppColors.primary),
            ),
            const SizedBox(height: 24),
            const Text(
              'Check Your Email',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            Text(
              'We sent a 6-digit verification code to\n$maskedEmail',
              style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.5),
              textAlign: TextAlign.center,
            ),

            const SizedBox(height: 36),

            // 6 OTP boxes
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(6, (i) => _buildOtpBox(i)),
            ),

            if (_error != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.error_outline, color: Colors.red.shade700, size: 16),
                    const SizedBox(width: 8),
                    Text(_error!, style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _verify,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: _loading
                    ? const SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Verify Email', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
            ),

            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text("Didn't receive a code? ", style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                _resendCooldown > 0
                    ? Text(
                        'Resend in ${_resendCooldown}s',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                      )
                    : GestureDetector(
                        onTap: _resending ? null : _resend,
                        child: Text(
                          _resending ? 'Sending...' : 'Resend Code',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
              ],
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () => context.go('/login'),
              child: const Text(
                'Back to Login',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOtpBox(int index) {
    final isFocused = _focus[index].hasFocus;
    final hasValue = _ctrl[index].text.isNotEmpty;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 5),
      width: 44,
      height: 54,
      decoration: BoxDecoration(
        color: hasValue
            ? AppColors.primary.withValues(alpha: 0.08)
            : AppColors.cardBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isFocused
              ? AppColors.primary
              : hasValue
                  ? AppColors.primary.withValues(alpha: 0.4)
                  : AppColors.border,
          width: isFocused ? 2 : 1,
        ),
        boxShadow: isFocused
            ? [BoxShadow(color: AppColors.primary.withValues(alpha: 0.15), blurRadius: 8)]
            : null,
      ),
      child: TextField(
          controller: _ctrl[index],
          focusNode: _focus[index],
          textAlign: TextAlign.center,
          keyboardType: TextInputType.number,
          maxLength: index == 0 ? 6 : 1,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: const InputDecoration(
            border: InputBorder.none,
            counterText: '',
          ),
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
          onChanged: (v) => _onDigitChanged(index, v),
      ),
    );
  }

  String _maskEmail(String email) {
    final parts = email.split('@');
    if (parts.length != 2) return email;
    final name = parts[0];
    final domain = parts[1];
    if (name.length <= 2) return '$name@$domain';
    final visible = name.substring(0, 2);
    final masked = '*' * (name.length - 2);
    return '$visible$masked@$domain';
  }
}
