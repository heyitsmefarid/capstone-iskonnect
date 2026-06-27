class FirebaseEnv {
  const FirebaseEnv._();

  // Firebase *client* configuration for the shared `iskonnect-15238` project.
  // These are not secrets (Firebase web/client config is inherently public — it
  // is already committed in admin-ui/.env; access is enforced by Firestore
  // security rules). They are provided as defaults so the app connects to the
  // same backend the admin panel reads, without requiring --dart-define flags.
  // Any value can still be overridden at build time, e.g.
  // `flutter run --dart-define=FIREBASE_API_KEY=...`.
  static const apiKey = String.fromEnvironment(
    'FIREBASE_API_KEY',
    defaultValue: 'AIzaSyBWQT1dMxTBwgi9C5pCChqa4v37Ywo5Zvc',
  );
  static const appId = String.fromEnvironment(
    'FIREBASE_APP_ID',
    defaultValue: '1:899384638137:web:778cf883f86dc35a3af968',
  );
  static const messagingSenderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
    defaultValue: '899384638137',
  );
  static const projectId = String.fromEnvironment(
    'FIREBASE_PROJECT_ID',
    defaultValue: 'iskonnect-15238',
  );
  static const storageBucket = String.fromEnvironment(
    'FIREBASE_STORAGE_BUCKET',
    defaultValue: 'iskonnect-15238.firebasestorage.app',
  );
  static const iosBundleId = String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID');

  static bool get isConfigured {
    return apiKey.isNotEmpty &&
        appId.isNotEmpty &&
        messagingSenderId.isNotEmpty &&
        projectId.isNotEmpty;
  }
}
