import 'firebase_config.dart';

/// Backward-compatible wrapper kept to avoid import breakage in older files.
class SupabaseConfig {
  static Future<void> initialize() async {
    await FirebaseConfig.initialize();
  }
}
