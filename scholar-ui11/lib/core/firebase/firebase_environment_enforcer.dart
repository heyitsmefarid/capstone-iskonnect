import 'package:flutter/foundation.dart';

/// Firebase environment configuration for scholar app
enum ScholarFirebaseEnvironment {
  production,
  staging,
  development,
}

/// Scholar app Firebase environment enforcer
class ScholarFirebaseEnvironmentEnforcer {
  static const String productionProjectId = 'capstone-production';
  static const String stagingProjectId = 'capstone-staging';
  static const String developmentProjectId = 'demo-capstone';

  static final Map<ScholarFirebaseEnvironment, Map<String, dynamic>>
      environmentConfig = {
    ScholarFirebaseEnvironment.production: {
      'projectId': productionProjectId,
      'apiUrl': 'https://api.iskonnect.prod',
      'readEnabled': true,
      'writeEnabled': true,
      'deleteEnabled': false,
      'documentUploadEnabled': true,
      'offlineEnabled': true,
      'maxStorageSize': 500 * 1024 * 1024, // 500MB
      'maxUploadSize': 50 * 1024 * 1024, // 50MB per file
      'requiresSSL': true,
    },
    ScholarFirebaseEnvironment.staging: {
      'projectId': stagingProjectId,
      'apiUrl': 'https://api.iskonnect.staging',
      'readEnabled': true,
      'writeEnabled': true,
      'deleteEnabled': true,
      'documentUploadEnabled': true,
      'offlineEnabled': true,
      'maxStorageSize': 300 * 1024 * 1024,
      'maxUploadSize': 100 * 1024 * 1024,
      'requiresSSL': true,
    },
    ScholarFirebaseEnvironment.development: {
      'projectId': developmentProjectId,
      'apiUrl': 'http://localhost:5173',
      'readEnabled': true,
      'writeEnabled': true,
      'deleteEnabled': true,
      'documentUploadEnabled': true,
      'offlineEnabled': true,
      'maxStorageSize': 100 * 1024 * 1024,
      'maxUploadSize': 200 * 1024 * 1024,
      'requiresSSL': false,
    },
  };

  /// Detect environment from project ID
  static ScholarFirebaseEnvironment detectEnvironment({
    required String projectId,
  }) {
    if (projectId == productionProjectId) {
      return ScholarFirebaseEnvironment.production;
    }

    if (projectId == stagingProjectId) {
      return ScholarFirebaseEnvironment.staging;
    }

    return ScholarFirebaseEnvironment.development;
  }

  /// Get environment name
  static String getEnvironmentName(ScholarFirebaseEnvironment env) {
    return env.toString().split('.').last.toUpperCase();
  }

  /// Check if document upload is allowed
  static bool isDocumentUploadAllowed(ScholarFirebaseEnvironment env) {
    return (environmentConfig[env]?['documentUploadEnabled'] as bool?) ?? true;
  }

  /// Get maximum upload size for environment
  static int getMaxUploadSize(ScholarFirebaseEnvironment env) {
    return (environmentConfig[env]?['maxUploadSize'] as int?) ??
        (50 * 1024 * 1024);
  }

  /// Validate document before upload
  static DocumentUploadValidation validateDocumentUpload({
    required ScholarFirebaseEnvironment environment,
    required int fileSize,
    required String fileName,
    required String mimeType,
  }) {
    final errors = <String>[];
    final warnings = <String>[];

    // Check if uploads are enabled
    if (!isDocumentUploadAllowed(environment)) {
      errors.add(
        'Document uploads are disabled in ${getEnvironmentName(environment)} environment',
      );
    }

    // Check file size
    final maxSize = getMaxUploadSize(environment);
    if (fileSize > maxSize) {
      errors.add(
        'File size exceeds maximum of ${(maxSize / (1024 * 1024)).toStringAsFixed(1)}MB',
      );
    }

    // Check file type
    final allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
    ];

    if (!allowedTypes.contains(mimeType)) {
      errors.add('File type not allowed: $mimeType');
    }

    // Warn in production
    if (environment == ScholarFirebaseEnvironment.production) {
      warnings.add(
        '⚠️ Uploading to PRODUCTION - Document will be permanently stored',
      );
    }

    return DocumentUploadValidation(
      isValid: errors.isEmpty,
      errors: errors,
      warnings: warnings,
    );
  }

  /// Enforce production safety for scholar app
  static void enforceProductionSafety({
    required ScholarFirebaseEnvironment environment,
    required String buildMode,
  }) {
    if (environment == ScholarFirebaseEnvironment.production) {
      // Ensure release mode
      if (!kReleaseMode) {
        throw ScholarFirebaseEnvironmentException(
          'SAFETY ERROR: Debug builds are not allowed for PRODUCTION. '
          'Please compile in release mode.',
        );
      }

      // Ensure HTTPS
      final config = environmentConfig[environment];
      if (config?['requiresSSL'] == true && buildMode.contains('http')) {
        throw ScholarFirebaseEnvironmentException(
          'SAFETY ERROR: Insecure connection not allowed in production.',
        );
      }

      debugPrint('⚠️ PRODUCTION MODE ENFORCED FOR SCHOLAR APP');
      debugPrint('Database: PRODUCTION');
      debugPrint('Document uploads: MONITORED');
    }
  }

  /// Get API URL for environment
  static String getApiUrl(ScholarFirebaseEnvironment env) {
    return (environmentConfig[env]?['apiUrl'] as String?) ??
        'https://api.iskonnect.prod';
  }

  /// Log environment info
  static void logEnvironmentInfo(ScholarFirebaseEnvironment environment) {
    final config = environmentConfig[environment];
    if (config == null) return;

    debugPrint('╔════════════════════════════════════╗');
    debugPrint('║ Scholar Firebase Environment       ║');
    debugPrint('╚════════════════════════════════════╝');
    debugPrint('Environment: ${getEnvironmentName(environment)}');
    debugPrint('Project ID: ${config["projectId"]}');
    debugPrint('API URL: ${config["apiUrl"]}');
    debugPrint('Document Upload: ${config["documentUploadEnabled"]}');
    debugPrint('Max Upload: ${(config["maxUploadSize"] as int) ~/ (1024 * 1024)}MB');
    debugPrint('Offline Support: ${config["offlineEnabled"]}');

    if (environment == ScholarFirebaseEnvironment.production) {
      debugPrint('');
      debugPrint(
        '⚠️  PRODUCTION - All document uploads are logged and monitored',
      );
    }
  }

  /// Create upload guard
  static DocumentUploadGuard createUploadGuard(
    ScholarFirebaseEnvironment environment,
  ) {
    return DocumentUploadGuard(environment: environment);
  }
}

/// Validation result for document uploads
class DocumentUploadValidation {
  final bool isValid;
  final List<String> errors;
  final List<String> warnings;

  DocumentUploadValidation({
    required this.isValid,
    required this.errors,
    required this.warnings,
  });

  String getErrorMessage() => errors.join('\n');
  String getWarningMessage() => warnings.join('\n');
}

/// Guard for document uploads
class DocumentUploadGuard {
  final ScholarFirebaseEnvironment environment;

  DocumentUploadGuard({required this.environment});

  /// Validate and execute upload
  Future<T> executeUpload<T>({
    required int fileSize,
    required String fileName,
    required String mimeType,
    required Future<T> Function() uploadOperation,
    required void Function(DocumentUploadValidation)? onValidation,
  }) async {
    final validation = ScholarFirebaseEnvironmentEnforcer
        .validateDocumentUpload(
      environment: environment,
      fileSize: fileSize,
      fileName: fileName,
      mimeType: mimeType,
    );

    onValidation?.call(validation);

    if (!validation.isValid) {
      throw ScholarFirebaseEnvironmentException(
        validation.getErrorMessage(),
      );
    }

    return uploadOperation();
  }
}

/// Exception for scholar Firebase environment errors
class ScholarFirebaseEnvironmentException implements Exception {
  final String message;

  ScholarFirebaseEnvironmentException(this.message);

  @override
  String toString() => 'ScholarFirebaseEnvironmentException: $message';
}
