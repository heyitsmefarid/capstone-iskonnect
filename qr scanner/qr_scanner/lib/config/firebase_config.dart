import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

class FirebaseConfig {
  const FirebaseConfig._();

  // Defaults point at the shared `iskonnect-15238` project (same backend the
  // admin/scholar apps use) so the scanner syncs without --dart-define flags.
  // Firebase web/client config is not secret; access is enforced by rules.
  static const String _apiKey = String.fromEnvironment(
    'FIREBASE_API_KEY',
    defaultValue: 'AIzaSyBWQT1dMxTBwgi9C5pCChqa4v37Ywo5Zvc',
  );
  static const String _appId = String.fromEnvironment(
    'FIREBASE_APP_ID',
    defaultValue: '1:899384638137:web:778cf883f86dc35a3af968',
  );
  static const String _messagingSenderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
    defaultValue: '899384638137',
  );
  static const String _projectId = String.fromEnvironment(
    'FIREBASE_PROJECT_ID',
    defaultValue: 'iskonnect-15238',
  );
  static const String _storageBucket = String.fromEnvironment(
    'FIREBASE_STORAGE_BUCKET',
    defaultValue: 'iskonnect-15238.firebasestorage.app',
  );
  static const String _iosBundleId = String.fromEnvironment(
    'FIREBASE_IOS_BUNDLE_ID',
  );

  static bool get isConfigured {
    return _apiKey.isNotEmpty &&
        _appId.isNotEmpty &&
        _messagingSenderId.isNotEmpty &&
        _projectId.isNotEmpty;
  }

  static Future<bool> initialize() async {
    if (!isConfigured) {
      return false;
    }

    await Firebase.initializeApp(
      options: FirebaseOptions(
        apiKey: _apiKey,
        appId: _appId,
        messagingSenderId: _messagingSenderId,
        projectId: _projectId,
        storageBucket: _storageBucket.isEmpty ? null : _storageBucket,
        iosBundleId: _iosBundleId.isEmpty ? null : _iosBundleId,
      ),
    );

    await _initializeAppCheck();

    // Firestore security rules require an authenticated session. The scanner
    // signs in anonymously so it can sync attendance writes.
    await _ensureSignedIn();

    return true;
  }

  /// Ensures an anonymous auth session exists for Firestore writes.
  static Future<void> _ensureSignedIn() async {
    try {
      if (FirebaseAuth.instance.currentUser == null) {
        await FirebaseAuth.instance
            .signInAnonymously()
            .timeout(const Duration(seconds: 8));
      }
    } catch (_) {
      // Sync will retry; offline-first storage is unaffected.
    }
  }

  static Future<void> _initializeAppCheck() async {
    const webSiteKey = String.fromEnvironment(
      'FIREBASE_APPCHECK_WEB_RECAPTCHA_SITE_KEY',
    );

    if (kIsWeb) {
      if (webSiteKey.isEmpty) {
        return;
      }

      await FirebaseAppCheck.instance.activate(
        providerWeb: ReCaptchaV3Provider(webSiteKey),
        providerAndroid: kDebugMode
            ? const AndroidDebugProvider()
            : const AndroidPlayIntegrityProvider(),
        providerApple: kDebugMode
            ? const AppleDebugProvider()
            : const AppleDeviceCheckProvider(),
      );
      return;
    }

    await FirebaseAppCheck.instance.activate(
      providerAndroid: kDebugMode
          ? const AndroidDebugProvider()
          : const AndroidPlayIntegrityProvider(),
      providerApple: kDebugMode
          ? const AppleDebugProvider()
          : const AppleDeviceCheckProvider(),
    );
  }
}
