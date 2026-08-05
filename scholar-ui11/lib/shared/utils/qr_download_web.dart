// ignore_for_file: deprecated_member_use
// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'dart:typed_data';

void downloadQrPng(Uint8List bytes, String filename) {
  downloadBytes(bytes, filename, mimeType: 'image/png');
}

/// Forces a real browser "Save As" download of arbitrary bytes, instead of
/// navigating to/opening the file in a new tab.
void downloadBytes(Uint8List bytes, String filename,
    {String mimeType = 'application/octet-stream'}) {
  final blob = html.Blob([bytes], mimeType);
  final url = html.Url.createObjectUrlFromBlob(blob);
  final anchor = html.AnchorElement(href: url)
    ..setAttribute('download', filename);
  anchor.click();
  html.Url.revokeObjectUrl(url);
}
