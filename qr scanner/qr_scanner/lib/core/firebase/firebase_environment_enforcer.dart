import 'package:flutter/foundation.dart';

/// Firebase environment types
enum FirebaseEnvironment {
  production,
  staging,
  development,
  emulator,
}

/// Firebase environment configuration and enforcement
class FirebaseEnvironmentEnforcer {
  static const String productionProjectId = 'capstone-production';
  static const String stagingProjectId = 'capstone-staging';
  static const String developmentProjectId = 'demo-capstone';

  static final Map<FirebaseEnvironment, Map<String, dynamic>> environmentConfig = {
    FirebaseEnvironment.production: {
      'projectId': productionProjectId,
      'readEnabled': true,
      'writeEnabled': true,
      'deleteEnabled': false,
      'requiresAuth': true,
      'offlineEnabled': true,
      'cacheSize': 100 * 1024 * 1024, // 100MB
    },
    FirebaseEnvironment.staging: {
      'projectId': stagingProjectId,
      'readEnabled': true,
      'writeEnabled': true,
      'deleteEnabled': true,
      'requiresAuth': true,
      'offlineEnabled': true,
      'cacheSize': 50 * 1024 * 1024,
    },
    FirebaseEnvironment.development: {
      'projectId': developmentProjectId,
      'readEnabled': true,
      'writeEnabled': true,
      'deleteEnabled': true,
      'requiresAuth': false,
      'offlineEnabled': true,
      'cacheSize': 20 * 1024 * 1024,
    },
    FirebaseEnvironment.emulator: {
      'projectId': developmentProjectId,
      'readEnabled': true,
      'writeEnabled': true,
      'deleteEnabled': true,
      'requiresAuth': false,
      'offlineEnabled': false,
      'cacheSize': 10 * 1024 * 1024,
    },
  };

  /// Detect current Firebase environment
  static FirebaseEnvironment detectEnvironment({
    required String projectId,
    bool useEmulator = false,
  }) {
    if (useEmulator) {
      return FirebaseEnvironment.emulator;
    }

    if (projectId == productionProjectId) {
      return FirebaseEnvironment.production;
    }

    if (projectId == stagingProjectId) {
      return FirebaseEnvironment.staging;
    }

    return FirebaseEnvironment.development;
  }

  /// Get environment name as string
  static String getEnvironmentName(FirebaseEnvironment env) {
    return env.toString().split('.').last.toUpperCase();
  }

  /// Check if operation is allowed in environment
  static bool isOperationAllowed(
    FirebaseEnvironment environment,
    String operation,
  ) {
    final config = environmentConfig[environment];
    if (config == null) return false;

    switch (operation) {
      case 'read':
        return config['readEnabled'] as bool? ?? true;
      case 'write':
        return config['writeEnabled'] as bool? ?? true;
      case 'delete':
        return config['deleteEnabled'] as bool? ?? true;
      case 'offline':
        return config['offlineEnabled'] as bool? ?? true;
      default:
        return false;
    }
  }

  /// Enforce production safety
  /// Prevents development/test code from running against production
  static void enforceProductionSafety({
    required FirebaseEnvironment environment,
    required String currentBuildMode,
  }) {
    if (environment == FirebaseEnvironment.production) {
      // Production safety checks

      // 1. Ensure running in release mode
      if (!kReleaseMode) {
        throw FirebaseEnvironmentException(
          'SAFETY ERROR: Cannot run debug build against PRODUCTION Firebase project. '
          'Please use release or profile build mode.',
        );
      }

      // 2. Verify not running tests
      if (currentBuildMode.contains('test')) {
        throw FirebaseEnvironmentException(
          'SAFETY ERROR: Cannot run tests against PRODUCTION Firebase project. '
          'Use DEVELOPMENT or STAGING environment for testing.',
        );
      }

      // 3. Log production mode
      debugPrint('⚠️ PRODUCTION MODE ENFORCED');
      debugPrint('Database: PRODUCTION');
      debugPrint('Delete operations: DISABLED');
      debugPrint('Write operations: MONITORED');
    }
  }

  /// Get cache size for environment
  static int getCacheSize(FirebaseEnvironment env) {
    return (environmentConfig[env]?['cacheSize'] as int?) ?? 50 * 1024 * 1024;
  }

  /// Validate Firebase configuration matches environment
  static bool validateConfiguration({
    required String projectId,
    required FirebaseEnvironment detectedEnvironment,
  }) {
    final expectedProjectId = environmentConfig[detectedEnvironment]?['projectId'];

    if (projectId != expectedProjectId) {
      debugPrint(
        'WARNING: Project ID mismatch. Expected: $expectedProjectId, Got: $projectId',
      );
      return false;
    }

    return true;
  }

  /// Log environment information
  static void logEnvironmentInfo(FirebaseEnvironment environment) {
    final config = environmentConfig[environment];
    if (config == null) return;

    debugPrint('╔════════════════════════════════════╗');
    debugPrint('║ Firebase Environment Configuration ║');
    debugPrint('╚════════════════════════════════════╝');
    debugPrint('Environment: ${getEnvironmentName(environment)}');
    debugPrint('Project ID: ${config["projectId"]}');
    debugPrint('Read Enabled: ${config["readEnabled"]}');
    debugPrint('Write Enabled: ${config["writeEnabled"]}');
    debugPrint('Delete Enabled: ${config["deleteEnabled"]}');
    debugPrint('Offline Enabled: ${config["offlineEnabled"]}');
    debugPrint('Cache Size: ${(config["cacheSize"] as int) ~/ (1024 * 1024)}MB');

    if (environment == FirebaseEnvironment.production) {
      debugPrint('');
      debugPrint('⚠️  PRODUCTION MODE - Operations will be logged and monitored');
    }
  }

  /// Create operation guard
  static OperationGuard createOperationGuard(
    FirebaseEnvironment environment,
    String operationType,
  ) {
    return OperationGuard(
      environment: environment,
      operationType: operationType,
    );
  }
}

/// Custom exception for Firebase environment errors
class FirebaseEnvironmentException implements Exception {
  final String message;

  FirebaseEnvironmentException(this.message);

  @override
  String toString() => 'FirebaseEnvironmentException: $message';
}

/// Guard for operations with environment checks
class OperationGuard {
  final FirebaseEnvironment environment;
  final String operationType;
  final List<String> warnings = [];

  OperationGuard({
    required this.environment,
    required this.operationType,
  });

  /// Check if operation is allowed
  Future<bool> canExecute() async {
    final allowed = FirebaseEnvironmentEnforcer.isOperationAllowed(
      environment,
      operationType,
    );

    if (!allowed) {
      warnings.add(
        'Operation "$operationType" is not allowed in ${FirebaseEnvironmentEnforcer.getEnvironmentName(environment)} environment',
      );
      return false;
    }

    // Add production warning
    if (environment == FirebaseEnvironment.production &&
        (operationType == 'write' || operationType == 'delete')) {
      warnings.add('⚠️ Operating on PRODUCTION database - changes will be permanent');
    }

    return true;
  }

  /// Execute with guards
  Future<T> execute<T>({
    required Future<T> Function() operation,
    required void Function(List<String>) onWarning,
  }) async {
    final allowed = await canExecute();

    if (!allowed) {
      throw FirebaseEnvironmentException(
        warnings.join('\n'),
      );
    }

    if (warnings.isNotEmpty) {
      onWarning(warnings);
    }

    return operation();
  }
}
