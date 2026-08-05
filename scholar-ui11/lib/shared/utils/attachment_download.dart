import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:iskonnectttt/shared/utils/qr_download_stub.dart'
    if (dart.library.html) 'package:iskonnectttt/shared/utils/qr_download_web.dart';

/// Fetches [url] and either triggers a real browser "Save As" download (web)
/// or saves it to the app's documents directory and opens it (mobile/desktop)
/// — instead of just handing the URL to the OS via `launchUrl`, which mostly
/// opens/displays the file rather than actually downloading it.
Future<void> downloadAttachment(
  BuildContext context, {
  required String url,
  required String fileName,
}) async {
  final messenger = ScaffoldMessenger.of(context);
  messenger.showSnackBar(
    const SnackBar(content: Text('Downloading...'), duration: Duration(seconds: 2)),
  );
  try {
    final response =
        await http.get(Uri.parse(url)).timeout(const Duration(seconds: 30));
    if (response.statusCode != 200) {
      throw Exception('Server returned ${response.statusCode}');
    }
    final safeName = fileName.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');

    if (kIsWeb) {
      downloadBytes(response.bodyBytes, safeName);
      return;
    }

    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/$safeName');
    await file.writeAsBytes(response.bodyBytes);
    if (!context.mounted) return;

    final result = await OpenFilex.open(file.path);
    if (result.type != ResultType.done && context.mounted) {
      messenger.showSnackBar(
        SnackBar(content: Text('Saved, but could not open it: ${result.message}')),
      );
    }
  } catch (e) {
    if (context.mounted) {
      messenger.showSnackBar(SnackBar(content: Text('Download failed: $e')));
    }
  }
}
