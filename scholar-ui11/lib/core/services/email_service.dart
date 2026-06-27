import 'dart:convert';

import 'package:http/http.dart' as http;

import '../constants/api_config.dart';

/// Result of an email/OTP operation.
class EmailResult {
  final bool success;
  final String message;

  /// Only populated in dev/emulator mode (no SMTP): the actual code, so the UI
  /// can display it for testing. Always null in production.
  final String? devCode;

  const EmailResult(this.success, this.message, {this.devCode});
}

/// Transactional email + OTP operations.
///
/// All email is sent server-side over SMTP by the project's Firebase Cloud
/// Functions (`sendEmailOTP`, `verifyEmailOTP`, `requestPasswordResetOTP`,
/// `resetPasswordWithOTP`) using nodemailer. The 6-digit codes are generated,
/// stored (hashed) and verified on the server — the client never sees or
/// compares the code itself. This replaces the old client-side EmailJS flow.
class EmailService {
  const EmailService._();

  static const Duration _timeout = Duration(seconds: 20);
  static const Map<String, String> _jsonHeaders = {
    'Content-Type': 'application/json',
  };

  /// Reads the human-readable error message out of a Cloud Function error body.
  static String _errorFrom(http.Response res, String fallback) {
    try {
      final body = jsonDecode(res.body);
      if (body is Map && body['error'] != null) {
        final err = body['error'];
        if (err is Map && err['message'] != null) return err['message'].toString();
        return err.toString();
      }
      if (body is Map && body['message'] != null) return body['message'].toString();
    } catch (_) {/* fall through */}
    return fallback;
  }

  // ── Email verification ─────────────────────────────────────────────────────

  /// Asks the server to email a 6-digit verification code to [toEmail].
  static Future<EmailResult> sendVerificationCode({required String toEmail}) async {
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.sendEmailOTP),
            headers: _jsonHeaders,
            body: jsonEncode({'email': toEmail.trim()}),
          )
          .timeout(_timeout);

      if (res.statusCode == 200) {
        String? devCode;
        try {
          final body = jsonDecode(res.body);
          if (body is Map && body['devCode'] != null) {
            devCode = body['devCode'].toString();
          }
        } catch (_) {/* ignore */}
        return EmailResult(
          true,
          'Verification code sent. Check your email.',
          devCode: devCode,
        );
      }
      return EmailResult(false, _errorFrom(res, 'Could not send the verification code.'));
    } catch (_) {
      return const EmailResult(
        false,
        'Unable to reach the email service. Check your connection and try again.',
      );
    }
  }

  /// Verifies the [code] the user entered for [toEmail].
  static Future<EmailResult> verifyCode({
    required String toEmail,
    required String code,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.verifyEmailOTP),
            headers: _jsonHeaders,
            body: jsonEncode({'email': toEmail.trim(), 'otp': code.trim()}),
          )
          .timeout(_timeout);

      if (res.statusCode == 200) {
        return const EmailResult(true, 'Email verified successfully.');
      }
      return EmailResult(false, _errorFrom(res, 'Incorrect or expired code.'));
    } catch (_) {
      return const EmailResult(
        false,
        'Unable to reach the verification service. Please try again.',
      );
    }
  }

  // ── Password reset ─────────────────────────────────────────────────────────

  /// Requests a password-reset code be emailed to [toEmail]. The response is
  /// intentionally generic (it does not reveal whether the account exists).
  static Future<EmailResult> requestPasswordReset({required String toEmail}) async {
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.requestPasswordResetOTP),
            headers: _jsonHeaders,
            body: jsonEncode({'email': toEmail.trim()}),
          )
          .timeout(_timeout);

      if (res.statusCode == 200) {
        return const EmailResult(
          true,
          'If an account exists for that email, a reset code has been sent.',
        );
      }
      return EmailResult(false, _errorFrom(res, 'Could not send the reset code.'));
    } catch (_) {
      return const EmailResult(
        false,
        'Unable to reach the email service. Check your connection and try again.',
      );
    }
  }

  /// Verifies the reset [code] and sets [newPassword] for [toEmail].
  static Future<EmailResult> resetPassword({
    required String toEmail,
    required String code,
    required String newPassword,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.resetPasswordWithOTP),
            headers: _jsonHeaders,
            body: jsonEncode({
              'email': toEmail.trim(),
              'otp': code.trim(),
              'newPassword': newPassword,
            }),
          )
          .timeout(_timeout);

      if (res.statusCode == 200) {
        return const EmailResult(
          true,
          'Your password has been reset. You can now sign in with your new password.',
        );
      }
      return EmailResult(false, _errorFrom(res, 'Could not reset your password.'));
    } catch (_) {
      return const EmailResult(
        false,
        'Unable to reach the reset service. Please try again.',
      );
    }
  }
}
