/// Constants used throughout the app
class AppConstants {
  // App info
  static const String appName = 'ISKONNECT';
  static const String appVersion = '1.0.0';
  static const String appDescription = 'Offline QR Attendance Scanner';

  // Storage keys
  static const String attendanceBoxKey = 'attendance_records';
  static const String eventsBoxKey = 'events';
  static const String adminBoxKey = 'admin';
  static const String settingsBoxKey = 'settings';

  // Settings keys
  static const String darkModeKey = 'darkMode';
  static const String autoSyncKey = 'autoSync';
  static const String apiEndpointKey = 'apiEndpoint';
  static const String currentEventKey = 'currentEventId';
  static const String currentAdminKey = 'currentAdminId';

  // API defaults
  static const String defaultApiEndpoint = 'https://api.iskonnect.edu/v1';
  static const int syncTimeoutSeconds = 30;
  static const int syncRetryAttempts = 3;

  // UI constants
  static const double borderRadius = 16.0;
  static const double cardElevation = 2.0;
  static const double iconSize = 24.0;
  static const double largeIconSize = 48.0;
  static const double scanButtonSize = 120.0;

  // Animation durations
  static const Duration shortAnimationDuration = Duration(milliseconds: 200);
  static const Duration mediumAnimationDuration = Duration(milliseconds: 400);
  static const Duration longAnimationDuration = Duration(milliseconds: 600);
  static const Duration scanFeedbackDuration = Duration(seconds: 2);

  // Validation
  static const int minStudentIdLength = 3;
  static const int maxStudentIdLength = 50;
}

/// Route names for navigation
class AppRoutes {
  static const String home = '/';
  static const String scanner = '/scanner';
  static const String history = '/history';
  static const String settings = '/settings';
  static const String eventManagement = '/events';
}
