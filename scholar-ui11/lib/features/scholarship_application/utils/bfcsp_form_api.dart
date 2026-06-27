import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../../../core/constants/api_config.dart';
import '../models/bfcsp_application_model.dart';

/// Client for the shared `generateApplicationForm` Cloud Function, which overlays
/// the applicant's data onto the real official template PDF (logos included) so
/// the output is identical to the printed form — the same generator the admin
/// panel uses. Falls back to the local Dart generator when unreachable.
class BfcspFormApi {
  const BfcspFormApi._();

  /// Requests the filled form from the backend. Returns the PDF bytes, or null
  /// if the call fails (caller should then fall back to local generation).
  static Future<Uint8List?> generate(BfcspApplicationModel app) async {
    try {
      final response = await http
          .post(
            Uri.parse(ApiConfig.generateApplicationForm),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({'application': app.toMap()}),
          )
          .timeout(const Duration(seconds: 20));

      if (response.statusCode == 200 && response.bodyBytes.isNotEmpty) {
        return response.bodyBytes;
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}
