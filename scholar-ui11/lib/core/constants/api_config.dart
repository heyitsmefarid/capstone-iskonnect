import 'package:flutter/foundation.dart' show kDebugMode;

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

  /// Explicit base URL of the BFCSP form service
  /// (backend/functions/local-form-server.js, or that same server hosted). e.g.:
  ///   flutter run --dart-define=FORM_BASE_URL=http://127.0.0.1:8091
  ///   flutter build apk --release --dart-define=FORM_BASE_URL=https://your-host
  static const String _explicitFormBaseUrl =
      String.fromEnvironment('FORM_BASE_URL', defaultValue: '');

  /// Default port `local-form-server.js` binds to when PORT/FORM_PORT are unset.
  static const String _localFormServer = 'http://127.0.0.1:8091';

  /// Where form-PDF requests go.
  ///
  /// This project deliberately does not deploy Cloud Functions (that needs the
  /// Blaze plan — see backend/functions/local-form-server.js and render.yaml),
  /// so `functionsBaseUrl` has no `generateApplicationForm` to answer: it 404s,
  /// which on Flutter web surfaces only as an opaque "Failed to fetch" CORS
  /// error. Falling back to it was therefore a guaranteed failure, so debug
  /// builds now default to the local form server instead — `flutter run` plus
  /// `node local-form-server.js` works with no extra flags.
  ///
  /// Release builds keep no fallback on purpose: 127.0.0.1 is meaningless on a
  /// user's phone, so a shipped build MUST pass FORM_BASE_URL. When it doesn't,
  /// this is empty and [generateApplicationForm] reports that directly rather
  /// than failing against a URL that was never going to work.
  static String get formBaseUrl {
    if (_explicitFormBaseUrl.isNotEmpty) return _explicitFormBaseUrl;
    return kDebugMode ? _localFormServer : '';
  }

  /// Endpoint that renders the official BFCSP application form (template overlay).
  /// Empty when no form service is configured — see [formBaseUrl].
  static String get generateApplicationForm =>
      formBaseUrl.isEmpty ? '' : '$formBaseUrl/generateApplicationForm';

  /// Root of the form service, for a best-effort warm-up ping — free hosting
  /// tiers sleep when idle and can take ~50s to cold start, which is longer
  /// than an applicant will wait after tapping Preview.
  static String? get formServiceOrigin =>
      formBaseUrl.isEmpty ? null : formBaseUrl;

  // ── Email OTP verification ────────────────────────────────────────────────
  // Uses the PHP + PHPMailer backend when OTP_BASE_URL is set; otherwise the
  // SMTP-backed Cloud Functions.
  static String get sendEmailOTP => otpBaseUrl.isNotEmpty
      ? '$otpBaseUrl/send_otp.php'
      : '$functionsBaseUrl/sendEmailOTP';
  static String get verifyEmailOTP => otpBaseUrl.isNotEmpty
      ? '$otpBaseUrl/verify_otp.php'
      : '$functionsBaseUrl/verifyEmailOTP';

  // Password reset intentionally has no endpoint here: it goes through Firebase
  // Auth's own reset email (AuthNotifier.sendPasswordResetEmail), which needs no
  // backend. The previous requestPasswordResetOTP/resetPasswordWithOTP getters
  // pointed at Cloud Functions that were never deployed.
}

/// EmailJS configuration — lets the app email the verification code directly
/// from the browser (no backend/hosting needed). The code itself is generated
/// and verified in-app. Values come from the EmailJS dashboard; the public key
/// is safe to ship (it only works from allow-listed origins).
///
/// Override at build time if needed, e.g.:
///   flutter build web --release --dart-define=EMAILJS_SERVICE_ID=service_xxxx
class EmailJsConfig {
  const EmailJsConfig._();

  static const String endpoint = 'https://api.emailjs.com/api/v1.0/email/send';

  static const String serviceId = String.fromEnvironment('EMAILJS_SERVICE_ID',
      defaultValue: 'service_eutbznw');
  static const String templateId = String.fromEnvironment(
      'EMAILJS_TEMPLATE_ID',
      defaultValue: 'template_q1mmi8v');
  static const String publicKey = String.fromEnvironment('EMAILJS_PUBLIC_KEY',
      defaultValue: 'SfuTnV6KYTzVV-sVD');

  static bool get isConfigured =>
      serviceId.isNotEmpty && templateId.isNotEmpty && publicKey.isNotEmpty;
}
