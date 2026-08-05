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

/// Client for the shared `generateApplicationForm` endpoint (served by
/// backend/functions/local-form-server.js — locally in development, hosted in
/// production; see ApiConfig.formBaseUrl). It overlays the applicant's data
/// onto the real official template PDF (logos included) so the output is
/// identical to the printed form — the same generator the admin panel uses.
///
/// There is deliberately no local/offline fallback: a divergent locally-drawn
/// layout would not match the official document, and Dart has no usable way to
/// overlay onto an existing PDF template anyway (the `pdf` package can only
/// import one via a concrete PdfDocumentParserBase, which is not shipped). If
/// the service is unreachable the caller must surface that, which is why every
/// failure here throws [BfcspFormException] naming the specific reason rather
/// than collapsing to a bare null.
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

    // No form service configured (release build without FORM_BASE_URL). Say so
    // outright instead of firing a request that cannot succeed — the previous
    // fallback to the never-deployed Cloud Functions URL produced an opaque
    // "Failed to fetch" that named the wrong cause.
    if (endpoint.isEmpty) {
      throw const BfcspFormException(
        'No form service is configured for this build. Rebuild with '
        '--dart-define=FORM_BASE_URL=<your form server URL> (see '
        'backend/functions/local-form-server.js and render.yaml).',
      );
    }

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
      throw BfcspFormException(
        'The form service at $endpoint answered 404 (not found). Something is '
        'listening there, but it is not the BFCSP form server — check the '
        'FORM_BASE_URL this build was given.',
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
