import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../../../core/constants/api_config.dart';
import '../models/bfcsp_application_model.dart';

/// Why a form-generation request failed, in terms the user (and whoever reads
/// the bug report) can act on.
class BfcspFormException implements Exception {
  final String message;

  const BfcspFormException(this.message);

  @override
  String toString() => message;
}

/// Client for the shared `generateApplicationForm` Cloud Function, which
/// overlays the applicant's data onto the real official template PDF (logos
/// included) so the output is identical to the printed form — the same
/// generator the admin panel uses.
///
/// There is deliberately no local/offline fallback: a divergent locally-drawn
/// layout would not match the official document. If the service is
/// unreachable the caller must surface that, which is why every failure here
/// throws [BfcspFormException] with a specific reason rather than collapsing
/// to a bare null. (The previous version returned null for *every* failure
/// mode and the UI reported it as a connectivity problem, which hid the real
/// cause: the endpoint answering HTTP 404 because the Cloud Functions
/// codebase was never deployed.)
class BfcspFormApi {
  const BfcspFormApi._();

  /// How long to wait for the form service. Sized to survive a cold start on a
  /// free hosting tier (~50s), not just a warm request — a shorter budget made
  /// the first preview after an idle period fail for no user-visible reason.
  static const Duration _requestTimeout = Duration(seconds: 60);

  /// Nudges a sleeping form service awake, so it is booting while the applicant
  /// fills the form instead of only starting when they tap Preview.
  ///
  /// Best-effort and side-effect free: every failure is swallowed, because a
  /// missed warm-up only costs the wait that [generate]'s timeout already
  /// covers. No-ops when the request would go to Cloud Functions.
  static Future<void> warmUp() async {
    final origin = ApiConfig.formServiceOrigin;
    if (origin == null) return;
    try {
      await http.get(Uri.parse(origin)).timeout(_requestTimeout);
    } catch (_) {
      // Intentionally ignored — see above.
    }
  }

  /// Requests the filled form from the backend, returning the PDF bytes.
  ///
  /// Throws [BfcspFormException] if the service cannot be reached, times out,
  /// answers with a non-200 status, or returns an empty body.
  static Future<Uint8List> generate(BfcspApplicationModel app) async {
    final endpoint = ApiConfig.generateApplicationForm;
    final http.Response response;

    try {
      response = await http
          .post(
            Uri.parse(endpoint),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({'application': app.toMap()}),
          )
          .timeout(_requestTimeout);
    } on TimeoutException {
      throw BfcspFormException(
        'The form service at $endpoint did not respond within '
        '${_requestTimeout.inSeconds} seconds.',
      );
    } catch (e) {
      throw BfcspFormException(
        'Could not reach the form service at $endpoint — $e',
      );
    }

    if (response.statusCode == 404) {
      // The single most likely cause, and the one that is invisible in local
      // development: builds without a FORM_BASE_URL override fall back to the
      // deployed Cloud Functions URL, so a codebase that was never deployed
      // fails only in shipped builds.
      throw BfcspFormException(
        'The form service returned 404 (not found) for $endpoint. '
        'The generateApplicationForm Cloud Function does not appear to be '
        'deployed for this project.',
      );
    }

    if (response.statusCode != 200) {
      throw BfcspFormException(
        'The form service returned HTTP ${response.statusCode} for $endpoint.',
      );
    }

    if (response.bodyBytes.isEmpty) {
      throw const BfcspFormException(
        'The form service returned an empty document.',
      );
    }

    return response.bodyBytes;
  }
}
