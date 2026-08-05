import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:printing/printing.dart';

/// Renders a PDF hosted at [url] in-app (page-by-page, pinch-zoom, share/print
/// built in) instead of handing the file off to whatever the OS considers the
/// default PDF app — which may not exist, especially on Android.
class InlinePdfPreview extends StatelessWidget {
  final String url;
  final double height;

  const InlinePdfPreview({super.key, required this.url, this.height = 460});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: PdfPreview(
        build: (format) async {
          final response =
              await http.get(Uri.parse(url)).timeout(const Duration(seconds: 30));
          if (response.statusCode != 200) {
            throw Exception('Server returned ${response.statusCode}');
          }
          return response.bodyBytes;
        },
        canChangeOrientation: false,
        canChangePageFormat: false,
        canDebug: false,
        allowSharing: true,
        allowPrinting: true,
        loadingWidget: const Center(child: CircularProgressIndicator()),
      ),
    );
  }
}

/// Whether [fileName]/[url] point at a PDF (the only format the `printing`
/// package can render inline — other office docs still need an external app).
bool isPdfFile(String? fileName, String? url) {
  final n = (fileName ?? '').toLowerCase();
  final u = (url ?? '').toLowerCase();
  return n.endsWith('.pdf') || u.endsWith('.pdf') || u.contains('.pdf?');
}
