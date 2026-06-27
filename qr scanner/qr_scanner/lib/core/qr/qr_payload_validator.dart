import 'dart:convert';
import 'package:crypto/crypto.dart';

/// QR Payload validation for Flutter
/// Mirrors backend validation with cryptographic verification

enum QRPayloadType {
  attendance,
  verification,
  unknown,
}

class QRPayloadValidator {
  static const String schemaVersion = '1.0';
  static const int maxTimestampAgeSec = 300;

  /// Parse and validate QR payload
  /// Returns null if invalid, otherwise returns validated payload
  static Future<Map<String, dynamic>?> validate(
    String qrData,
    String signingSecret, {
    int? maxAgeSeconds,
  }) async {
    try {
      // 1. Parse JSON
      final payload = jsonDecode(qrData) as Map<String, dynamic>;

      // 2. Validate structure
      final structureErrors = _validateStructure(payload);
      if (structureErrors.isNotEmpty) {
        _logError('Structure validation failed: $structureErrors');
        return null;
      }

      // 3. Validate timestamp
      final isRecentValid = _validateTimestamp(
        payload['timestamp'] as String,
        maxAgeSeconds ?? maxTimestampAgeSec,
      );
      if (!isRecentValid) {
        _logError('Timestamp validation failed');
        return null;
      }

      // 4. Verify signature
      final isSignatureValid = _verifySignature(payload, signingSecret);
      if (!isSignatureValid) {
        _logError('Signature verification failed');
        return null;
      }

      _logInfo('QR payload validated successfully');
      return payload;
    } catch (e) {
      _logError('QR payload validation error: $e');
      return null;
    }
  }

  /// Validate QR payload structure
  static List<String> _validateStructure(Map<String, dynamic> payload) {
    final errors = <String>[];

    final requiredFields = [
      'schemaVersion',
      'eventId',
      'scholarId',
      'timestamp',
      'signature',
      'data'
    ];

    for (final field in requiredFields) {
      if (!payload.containsKey(field)) {
        errors.add('Missing required field: $field');
      }
    }

    // Validate schema version
    if (payload['schemaVersion'] != schemaVersion) {
      errors.add('Invalid schema version: ${payload['schemaVersion']}');
    }

    // Validate field types
    if (payload['eventId'] is! String) {
      errors.add('eventId must be a string');
    }

    if (payload['scholarId'] is! String) {
      errors.add('scholarId must be a string');
    }

    if (payload['timestamp'] is! String) {
      errors.add('timestamp must be a string');
    }

    if (payload['signature'] is! String) {
      errors.add('signature must be a string');
    }

    if (payload['data'] is! Map) {
      errors.add('data must be an object');
    }

    return errors;
  }

  /// Validate timestamp is recent
  static bool _validateTimestamp(String timestampStr, int maxAgeSec) {
    try {
      final timestamp = DateTime.parse(timestampStr);
      final now = DateTime.now();
      final age = now.difference(timestamp).inSeconds;

      // Allow 60 sec clock skew in future
      if (age < -60) {
        _logWarning('Timestamp is in the future: ${-age}s');
        return false;
      }

      if (age > maxAgeSec) {
        _logWarning('Timestamp is too old: ${age}s (max: $maxAgeSec)');
        return false;
      }

      return true;
    } catch (e) {
      _logError('Invalid timestamp: $e');
      return false;
    }
  }

  /// Verify payload signature using HMAC-SHA256
  static bool _verifySignature(Map<String, dynamic> payload, String secret) {
    try {
      // Extract signature from payload
      final providedSignature = payload['signature'] as String;

      // Create payload copy without signature
      final payloadToVerify = Map<String, dynamic>.from(payload)..remove('signature');

      // Stringify in deterministic order (sorted keys)
      final keys = payloadToVerify.keys.toList()..sort();
      final Map<String, dynamic> sortedPayload = {};
      for (final key in keys) {
        sortedPayload[key] = payloadToVerify[key];
      }

      final payloadStr = jsonEncode(sortedPayload);

      // Calculate HMAC-SHA256
      final key = utf8.encode(secret);
      final bytes = utf8.encode(payloadStr);
      final hmac = Hmac(sha256, key);
      final signature = hmac.convert(bytes).toString();

      // Compare signatures (timing-safe comparison)
      final match = _timingSafeEquals(providedSignature, signature);

      if (!match) {
        _logWarning('Signature mismatch');
        return false;
      }

      return true;
    } catch (e) {
      _logError('Signature verification error: $e');
      return false;
    }
  }

  /// Timing-safe string comparison to prevent timing attacks
  static bool _timingSafeEquals(String a, String b) {
    if (a.length != b.length) {
      return false;
    }

    int result = 0;
    for (int i = 0; i < a.length; i++) {
      result |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }

    return result == 0;
  }

  /// Decrypt QR payload data (if encrypted)
  static String generateSignature(Map<String, dynamic> payload, String secret) {
    // Remove signature if present
    final payloadToSign = Map<String, dynamic>.from(payload)..remove('signature');

    // Stringify in deterministic order
    final keys = payloadToSign.keys.toList()..sort();
    final Map<String, dynamic> sortedPayload = {};
    for (final key in keys) {
      sortedPayload[key] = payloadToSign[key];
    }

    final payloadStr = jsonEncode(sortedPayload);

    // Generate HMAC-SHA256
    final key = utf8.encode(secret);
    final bytes = utf8.encode(payloadStr);
    final hmac = Hmac(sha256, key);
    return hmac.convert(bytes).toString();
  }

  /// Log functions
  static void _logInfo(String message) {
    // ignore: avoid_print
    print('[QRValidator] INFO: $message');
  }

  static void _logWarning(String message) {
    // ignore: avoid_print
    print('[QRValidator] WARNING: $message');
  }

  static void _logError(String message) {
    // ignore: avoid_print
    print('[QRValidator] ERROR: $message');
  }
}
