import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

/// Uploads applicant/scholar requirement files to **Cloudinary** (free tier, no
/// backend / no Blaze plan needed) and returns a public delivery URL the admin
/// panel can view or download.
///
/// Uses an *unsigned* upload preset, so the file is sent straight from the app
/// with no signature/secret — the preset (`capstone`) defines what's allowed.
/// The `auto` resource type handles any file type: images, PDFs, Word/Excel.
class StorageService {
  const StorageService._();

  // Cloudinary account (unsigned client uploads).
  static const String _cloudName = 'c42z63hb';
  static const String _uploadPreset = 'capstone';
  static const Duration _timeout = Duration(seconds: 60);

  /// Maximum accepted file size (10 MB) — Cloudinary's free tier allows up to
  /// 10 MB per file, and this keeps uploads quick on mobile data.
  static const int maxFileBytes = 10 * 1024 * 1024;

  /// Uploads [bytes] and returns the public URL, or null if the file is empty /
  /// too large / the upload fails. Accepts any file type.
  static Future<String?> uploadRequirementFile({
    required String studentId,
    required String requirementId,
    required String fileName,
    required Uint8List bytes,
  }) async {
    if (bytes.lengthInBytes == 0 || bytes.lengthInBytes > maxFileBytes) {
      return null;
    }

    try {
      final safeName = fileName.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
      final uri = Uri.parse(
        'https://api.cloudinary.com/v1_1/$_cloudName/auto/upload',
      );

      final request = http.MultipartRequest('POST', uri)
        ..fields['upload_preset'] = _uploadPreset
        ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: safeName));

      final streamed = await request.send().timeout(_timeout);
      final res = await http.Response.fromStream(streamed);

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final url = data['secure_url'] ?? data['url'];
        return url is String ? url : null;
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}
