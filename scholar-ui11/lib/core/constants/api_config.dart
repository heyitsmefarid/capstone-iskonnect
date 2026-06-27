/// Base URL for the project's Firebase Cloud Functions (HTTPS endpoints).
///
/// Defaults to the deployed `iskonnect-15238` functions in us-central1. Override
/// for local testing against the emulator, e.g.:
///   flutter run --dart-define=FUNCTIONS_BASE_URL=http://127.0.0.1:5001/iskonnect-15238/us-central1
class ApiConfig {
  const ApiConfig._();

  static const bool _useEmulators =
      bool.fromEnvironment('USE_EMULATORS', defaultValue: false);

  static const String _explicitBaseUrl =
      String.fromEnvironment('FUNCTIONS_BASE_URL', defaultValue: '');

  /// Base URL of the PHP + PHPMailer OTP backend (the folder containing
  /// send_otp.php / verify_otp.php). When set, email verification uses PHP
  /// instead of the (Blaze-only) Cloud Functions. e.g.:
  ///   flutter run --dart-define=OTP_BASE_URL=http://localhost/php-otp
  static const String otpBaseUrl =
      String.fromEnvironment('OTP_BASE_URL', defaultValue: '');

  /// An explicit `FUNCTIONS_BASE_URL` wins; otherwise emulator mode points at the
  /// local Functions emulator (demo-capstone), and the default is the deployed
  /// `iskonnect-15238` functions.
  static String get functionsBaseUrl {
    if (_explicitBaseUrl.isNotEmpty) return _explicitBaseUrl;
    if (_useEmulators) return 'http://127.0.0.1:5001/demo-capstone/us-central1';
    return 'https://us-central1-iskonnect-15238.cloudfunctions.net';
  }

  /// Base URL of the local BFCSP form server (backend/functions/local-form-server.js),
  /// used when Cloud Functions aren't deployed. e.g.:
  ///   flutter run --dart-define=FORM_BASE_URL=http://127.0.0.1:8091
  static const String formBaseUrl =
      String.fromEnvironment('FORM_BASE_URL', defaultValue: '');

  /// Endpoint that renders the official BFCSP application form (template overlay).
  static String get generateApplicationForm => formBaseUrl.isNotEmpty
      ? '$formBaseUrl/generateApplicationForm'
      : '$functionsBaseUrl/generateApplicationForm';

  // ── Email OTP verification ────────────────────────────────────────────────
  // Uses the PHP + PHPMailer backend when OTP_BASE_URL is set; otherwise the
  // SMTP-backed Cloud Functions.
  static String get sendEmailOTP => otpBaseUrl.isNotEmpty
      ? '$otpBaseUrl/send_otp.php'
      : '$functionsBaseUrl/sendEmailOTP';
  static String get verifyEmailOTP => otpBaseUrl.isNotEmpty
      ? '$otpBaseUrl/verify_otp.php'
      : '$functionsBaseUrl/verifyEmailOTP';

  // ── Password reset via emailed OTP ────────────────────────────────────────
  // Reset email goes through the PHP backend when OTP_BASE_URL is set; the code
  // is verified via verify_otp.php and the app sets the new password itself.
  static String get requestPasswordResetOTP => otpBaseUrl.isNotEmpty
      ? '$otpBaseUrl/request_password_reset.php'
      : '$functionsBaseUrl/requestPasswordResetOTP';
  static String get resetPasswordWithOTP =>
      '$functionsBaseUrl/resetPasswordWithOTP';
}
