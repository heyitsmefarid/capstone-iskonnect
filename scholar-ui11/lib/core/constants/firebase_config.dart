import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';

import 'firebase_env.dart';

class FirebaseConfig {
  const FirebaseConfig._();

  /// Compile-time flag (`--dart-define=USE_EMULATORS=true`) that points the app
  /// at the local Firebase emulator suite (Auth 9099, Firestore 8080, Storage
  /// 9199) under the `demo-capstone` project — the same project the admin panel
  /// uses in `npm run dev:emu`, so they share data. Used to test uploads
  /// end-to-end without touching production.
  static const bool useEmulators =
      bool.fromEnvironment('USE_EMULATORS', defaultValue: false);

  static Future<bool> initialize() async {
    if (!useEmulators && !FirebaseEnv.isConfigured) {
      return false;
    }

    await Firebase.initializeApp(
      options: useEmulators ? _emulatorOptions : _options,
    );

    if (useEmulators) {
      _connectEmulators();
    } else {
      await _initializeAppCheck();
    }

    await _ensureSignedIn();
    return true;
  }

  static void _connectEmulators() {
    const host = 'localhost';
    try {
      FirebaseAuth.instance.useAuthEmulator(host, 9099);
      FirebaseFirestore.instance.useFirestoreEmulator(host, 8080);
      FirebaseStorage.instance.useStorageEmulator(host, 9199);
    } catch (_) {
      // Connecting twice (hot restart) throws; safe to ignore.
    }
  }

  // Emulator ignores real credentials but namespaces data by projectId, so this
  // must match the project the Functions/Firestore emulator runs under.
  static FirebaseOptions get _emulatorOptions => const FirebaseOptions(
        apiKey: 'demo-key',
        appId: '1:000000000000:web:demo',
        messagingSenderId: '000000000000',
        projectId: 'demo-capstone',
        storageBucket: 'demo-capstone.appspot.com',
      );

  /// Sign in anonymously so Firestore security rules (which require an
  /// authenticated session) allow the app to read and write student records.
  static Future<void> _ensureSignedIn() async {
    try {
      final auth = FirebaseAuth.instance;
      if (auth.currentUser == null) {
        await auth.signInAnonymously();
      }
    } catch (_) {
      // Keep the app usable offline even if anonymous sign-in fails.
    }
  }

  static Future<void> _initializeAppCheck() async {
    final webSiteKey = const String.fromEnvironment(
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

  static FirebaseOptions get _options {
    return FirebaseOptions(
      apiKey: FirebaseEnv.apiKey,
      appId: FirebaseEnv.appId,
      messagingSenderId: FirebaseEnv.messagingSenderId,
      projectId: FirebaseEnv.projectId,
      storageBucket: FirebaseEnv.storageBucket.isEmpty
          ? null
          : FirebaseEnv.storageBucket,
      iosBundleId: FirebaseEnv.iosBundleId.isEmpty
          ? null
          : FirebaseEnv.iosBundleId,
    );
  }
}
