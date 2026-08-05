import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/constants/api_config.dart';

// These run without a FORM_BASE_URL --dart-define, so they cover the default
// path — the one that silently broke: it used to fall back to the project's
// Cloud Functions URL, which has no generateApplicationForm deployed (this
// project deliberately never deploys Functions), so every form preview failed
// with an opaque "Failed to fetch".
void main() {
  group('form service URL defaults (no FORM_BASE_URL override)', () {
    test('never falls back to the Cloud Functions host', () {
      // The specific regression: a URL that is guaranteed to 404 here.
      expect(ApiConfig.formBaseUrl, isNot(contains('cloudfunctions.net')));
      expect(
        ApiConfig.generateApplicationForm,
        isNot(contains('cloudfunctions.net')),
      );
    });

    test('debug builds point at the local form server; release stays empty', () {
      if (kDebugMode) {
        // `flutter run` + `node local-form-server.js` must work with no flags.
        expect(ApiConfig.formBaseUrl, 'http://127.0.0.1:8091');
        expect(
          ApiConfig.generateApplicationForm,
          'http://127.0.0.1:8091/generateApplicationForm',
        );
      } else {
        // 127.0.0.1 is meaningless on a user's phone, so a shipped build must
        // be given FORM_BASE_URL rather than silently targeting something it
        // can never reach.
        expect(ApiConfig.formBaseUrl, isEmpty);
        expect(ApiConfig.generateApplicationForm, isEmpty);
      }
    });

    test('formServiceOrigin is null exactly when no service is configured', () {
      if (ApiConfig.formBaseUrl.isEmpty) {
        expect(ApiConfig.formServiceOrigin, isNull);
      } else {
        expect(ApiConfig.formServiceOrigin, ApiConfig.formBaseUrl);
      }
    });

    test('generateApplicationForm is empty or a full URL, never a bare path', () {
      final endpoint = ApiConfig.generateApplicationForm;
      if (endpoint.isNotEmpty) {
        expect(Uri.parse(endpoint).hasScheme, isTrue);
        expect(endpoint, endsWith('/generateApplicationForm'));
      }
    });
  });

  group('unrelated endpoints keep using the functions host', () {
    test('functionsBaseUrl still resolves for OTP endpoints', () {
      // Only the form service was moved off Cloud Functions; the OTP getters
      // still compose against functionsBaseUrl when no OTP_BASE_URL is set.
      expect(ApiConfig.functionsBaseUrl, isNotEmpty);
      expect(ApiConfig.sendEmailOTP, contains('sendEmailOTP'));
      expect(ApiConfig.verifyEmailOTP, contains('verifyEmailOTP'));
    });
  });
}
