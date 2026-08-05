import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;

import '../constants/api_config.dart';

/// A pending verification code held in memory for the current app session.
class _OtpEntry {
  final String code;
  final DateTime expiresAt;
  int attempts = 0;
  _OtpEntry(this.code, this.expiresAt);
}

/// Result of an email/OTP operation.
class EmailResult {
  final bool success;
  final String message;

  /// Only populated in dev/emulator mode (no SMTP): the actual code, so the UI
  /// can display it for testing. Always null in production.
  final String? devCode;

  const EmailResult(this.success, this.message, {this.devCode});
}

/// Registration email verification.
///
/// The 6-digit code is generated on the device, held in memory for the app
/// session, and compared locally; EmailJS is used purely as a delivery
/// mechanism for the email itself. No backend of ours is involved, which is
/// why registration keeps working in builds that cannot reach Cloud Functions.
///
/// (An earlier version of this comment claimed the opposite — that codes were
/// generated and verified server-side by `sendEmailOTP`/`verifyEmailOTP` Cloud
/// Functions, and that this "replaces the old client-side EmailJS flow". That
/// was stale in both directions: those functions are not called anywhere and
/// were never deployed. Corrected here because the wrong comment led to a
/// wrong diagnosis of registration as broken.)
class EmailService {
  const EmailService._();

  static const Duration _timeout = Duration(seconds: 20);
  static const Map<String, String> _jsonHeaders = {
    'Content-Type': 'application/json',
  };

  // ── Email verification (EmailJS, no backend) ───────────────────────────────
  // The 6-digit code is generated and verified in-app; EmailJS only delivers
  // the email. Codes live in memory for the app session and expire after 10 min.

  static const Duration _otpTtl = Duration(minutes: 10);
  static const int _otpMaxAttempts = 5;
  static final Map<String, _OtpEntry> _pendingCodes = {};

  static String _generateCode() {
    // 100000–999999, cryptographically-random so it isn't guessable.
    return (Random.secure().nextInt(900000) + 100000).toString();
  }

  /// Generates a 6-digit code, stores it for [toEmail], and emails it via
  /// EmailJS. The code never leaves the device except inside the email body.
  static Future<EmailResult> sendVerificationCode({required String toEmail}) async {
    final email = toEmail.trim();
    if (!EmailJsConfig.isConfigured) {
      return const EmailResult(
        false,
        'Email service is not configured yet. Please try again later.',
      );
    }

    final code = _generateCode();
    _pendingCodes[email.toLowerCase()] =
        _OtpEntry(code, DateTime.now().add(_otpTtl));

    try {
      final res = await http
          .post(
            Uri.parse(EmailJsConfig.endpoint),
            headers: _jsonHeaders,
            body: jsonEncode({
              'service_id': EmailJsConfig.serviceId,
              'template_id': EmailJsConfig.templateId,
              'user_id': EmailJsConfig.publicKey,
              'template_params': {
                'to_email': email,
                'email': email,
                'passcode': code,
                'code': code,
                'time': '10 minutes',
              },
            }),
          )
          .timeout(_timeout);

      if (res.statusCode == 200) {
        return const EmailResult(
          true,
          'Verification code sent. Check your email.',
        );
      }
      // EmailJS returns a plain-text reason (e.g. origin not allowed).
      final reason = res.body.trim();
      return EmailResult(
        false,
        reason.isNotEmpty
            ? 'Could not send the verification code: $reason'
            : 'Could not send the verification code.',
      );
    } catch (_) {
      return const EmailResult(
        false,
        'Unable to reach the email service. Check your connection and try again.',
      );
    }
  }

  /// Verifies the [code] the user entered for [toEmail] against the in-memory
  /// code issued by [sendVerificationCode].
  static Future<EmailResult> verifyCode({
    required String toEmail,
    required String code,
  }) async {
    final key = toEmail.trim().toLowerCase();
    final entry = _pendingCodes[key];

    if (entry == null) {
      return const EmailResult(
        false,
        'No active verification code found. Please request a new one.',
      );
    }
    if (DateTime.now().isAfter(entry.expiresAt)) {
      _pendingCodes.remove(key);
      return const EmailResult(
        false,
        'Verification code has expired. Please request a new one.',
      );
    }
    if (entry.attempts >= _otpMaxAttempts) {
      _pendingCodes.remove(key);
      return const EmailResult(
        false,
        'Too many incorrect attempts. Please request a new verification code.',
      );
    }
    if (entry.code != code.trim()) {
      entry.attempts++;
      final remaining = _otpMaxAttempts - entry.attempts;
      return EmailResult(
        false,
        remaining > 0
            ? 'Incorrect code. $remaining attempt${remaining == 1 ? '' : 's'} remaining.'
            : 'Too many incorrect attempts. Please request a new verification code.',
      );
    }

    _pendingCodes.remove(key);
    return const EmailResult(true, 'Email verified successfully.');
  }

  // Password reset is not handled here. It goes through Firebase Auth's own
  // reset email — see `AuthNotifier.sendPasswordResetEmail`. The two methods
  // that used to live here posted to `requestPasswordResetOTP` /
  // `resetPasswordWithOTP` Cloud Functions that were never deployed, and
  // setting another user's password client-side is impossible anyway without
  // a reset token or the Admin SDK.
}
