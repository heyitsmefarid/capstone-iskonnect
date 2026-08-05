import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/shared/widgets/inline_pdf_preview.dart';

class DialogHelper {
  /// Opens a read-only viewer for a file the scholar has already submitted.
  /// Images render inline (from in-memory [bytes] first, then a hosted/data-URI
  /// [fileUrl]); other files (PDF) offer to open externally when a URL exists.
  static void showFileViewer({
    required BuildContext context,
    required String fileName,
    Uint8List? bytes,
    String? fileUrl,
  }) {
    final isImage =
        RegExp(r'\.(png|jpe?g|gif|webp|bmp)$').hasMatch(fileName.toLowerCase());

    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        insetPadding: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640, maxHeight: 720),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 8, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        fileName,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 15),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.of(ctx).pop(),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  child: isImage
                      ? _viewerImage(bytes, fileUrl)
                      : _viewerNonImage(ctx, fileName, fileUrl),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static Widget _viewerImage(Uint8List? bytes, String? url) {
    const errorWidget = Center(
      child: Padding(
        padding: EdgeInsets.all(28),
        child: Text('Could not load image.'),
      ),
    );

    if (bytes != null && bytes.isNotEmpty) {
      return InteractiveViewer(
        child: Image.memory(bytes,
            fit: BoxFit.contain, errorBuilder: (_, _, _) => errorWidget),
      );
    }
    if (url == null || url.isEmpty) return errorWidget;

    if (url.startsWith('data:')) {
      final idx = url.indexOf('base64,');
      if (idx == -1) return errorWidget;
      try {
        final decoded = base64Decode(url.substring(idx + 'base64,'.length));
        return InteractiveViewer(
          child: Image.memory(decoded,
              fit: BoxFit.contain, errorBuilder: (_, _, _) => errorWidget),
        );
      } catch (_) {
        return errorWidget;
      }
    }

    return InteractiveViewer(
      child: Image.network(
        url,
        fit: BoxFit.contain,
        loadingBuilder: (context, child, progress) => progress == null
            ? child
            : const Center(
                child: Padding(
                    padding: EdgeInsets.all(28),
                    child: CircularProgressIndicator())),
        errorBuilder: (_, _, _) => errorWidget,
      ),
    );
  }

  static Widget _viewerNonImage(
      BuildContext ctx, String fileName, String? url) {
    if (url != null && url.isNotEmpty && isPdfFile(fileName, url)) {
      return InlinePdfPreview(url: url);
    }

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.picture_as_pdf_rounded,
              size: 56, color: AppColors.primary),
          const SizedBox(height: 12),
          Text(fileName,
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          if (url != null && url.isNotEmpty)
            ElevatedButton.icon(
              onPressed: () async {
                final uri = Uri.tryParse(url);
                if (uri == null) return;
                final ok =
                    await launchUrl(uri, mode: LaunchMode.externalApplication);
                if (!ok && ctx.mounted) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Could not open the file.')),
                  );
                }
              },
              icon: const Icon(Icons.open_in_new, size: 18),
              label: const Text('Open file'),
            )
          else
            const Text(
              'Preview is not available for this file type, but it has been submitted.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
        ],
      ),
    );
  }

  /// Shows the file the user just picked and asks them to confirm before it is
  /// uploaded. Image files render as a visual preview; other files (PDF) show
  /// the file name and size. Returns `true` when the user taps Submit,
  /// `false`/`null` when they cancel or choose a different file.
  static Future<bool> showFilePreviewConfirm({
    required BuildContext context,
    required String fileName,
    int? fileSize,
    Uint8List? bytes,
    String title = 'Confirm Submission',
    String confirmText = 'Submit',
    String cancelText = 'Cancel',
  }) async {
    final isImage =
        RegExp(r'\.(png|jpe?g|gif|webp|bmp)$').hasMatch(fileName.toLowerCase());
    final canPreviewImage = isImage && bytes != null && bytes.isNotEmpty;

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => Dialog(
        insetPadding: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560, maxHeight: 680),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
                child: Row(
                  children: [
                    const Icon(Icons.visibility_outlined,
                        color: AppColors.primary, size: 24),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        title,
                        style: const TextStyle(
                            fontSize: 17, fontWeight: FontWeight.w700),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.of(ctx).pop(false),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: canPreviewImage
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: InteractiveViewer(
                            child: Image.memory(
                              bytes,
                              fit: BoxFit.contain,
                              errorBuilder: (_, _, _) =>
                                  _fileTile(fileName, fileSize),
                            ),
                          ),
                        )
                      : _fileTile(fileName, fileSize),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                child: Text(
                  canPreviewImage
                      ? 'Please review the image above before submitting.'
                      : 'Please confirm this is the correct file before submitting.',
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.textSecondary),
                  textAlign: TextAlign.center,
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(ctx).pop(false),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textSecondary,
                          side: const BorderSide(color: AppColors.divider),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: Text(cancelText),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => Navigator.of(ctx).pop(true),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: Text(confirmText),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
    return result ?? false;
  }

  static Widget _fileTile(String fileName, int? fileSize) {
    final isPdf = fileName.toLowerCase().endsWith('.pdf');
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isPdf ? Icons.picture_as_pdf_rounded : Icons.insert_drive_file_outlined,
            size: 56,
            color: AppColors.primary,
          ),
          const SizedBox(height: 14),
          Text(
            fileName,
            style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          if (fileSize != null) ...[
            const SizedBox(height: 4),
            Text(
              _formatBytes(fileSize),
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textTertiary),
            ),
          ],
        ],
      ),
    );
  }

  static String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  static void showSuccessDialog({
    required BuildContext context,
    required String title,
    required String message,
    String buttonText = 'OK',
    VoidCallback? onPressed,
  }) {
    _show(
      context: context,
      icon: Icons.check_circle_rounded,
      iconColor: AppColors.success,
      title: title,
      message: message,
      buttonText: buttonText,
      buttonColor: AppColors.success,
      onPressed: onPressed,
    );
  }

  static void showErrorDialog({
    required BuildContext context,
    required String title,
    required String message,
    String buttonText = 'OK',
    VoidCallback? onPressed,
  }) {
    _show(
      context: context,
      icon: Icons.cancel_rounded,
      iconColor: AppColors.error,
      title: title,
      message: message,
      buttonText: buttonText,
      buttonColor: AppColors.error,
      onPressed: onPressed,
    );
  }

  static void showWarningDialog({
    required BuildContext context,
    required String title,
    required String message,
    String buttonText = 'OK',
    VoidCallback? onPressed,
  }) {
    _show(
      context: context,
      icon: Icons.warning_rounded,
      iconColor: AppColors.warning,
      title: title,
      message: message,
      buttonText: buttonText,
      buttonColor: AppColors.warning,
      onPressed: onPressed,
    );
  }

  static void showInfoDialog({
    required BuildContext context,
    required String title,
    required String message,
    String buttonText = 'OK',
    VoidCallback? onPressed,
  }) {
    _show(
      context: context,
      icon: Icons.info_rounded,
      iconColor: AppColors.info,
      title: title,
      message: message,
      buttonText: buttonText,
      buttonColor: AppColors.info,
      onPressed: onPressed,
    );
  }

  static void showConfirmDialog({
    required BuildContext context,
    required String title,
    required String message,
    String confirmText = 'Yes',
    String cancelText = 'No',
    required VoidCallback onConfirm,
    VoidCallback? onCancel,
    dynamic dialogType, // kept for API compatibility
  }) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.help_rounded, color: AppColors.primary, size: 28),
            const SizedBox(width: 10),
            Flexible(child: Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
          ],
        ),
        content: Text(message, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary)),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              (onCancel ?? () {})();
            },
            child: Text(cancelText, style: const TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
            onPressed: () {
              Navigator.of(ctx).pop();
              onConfirm();
            },
            child: Text(confirmText),
          ),
        ],
      ),
    );
  }

  static void showLoadingDialog(BuildContext context, {String? message}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => PopScope(
        canPop: false,
        child: Dialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                ),
                const SizedBox(width: 20),
                Flexible(
                  child: Text(
                    message ?? 'Please wait...',
                    style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static void hideLoadingDialog(BuildContext context) {
    Navigator.of(context, rootNavigator: true).pop();
  }

  static void showBottomSheet({
    required BuildContext context,
    required Widget child,
    bool isDismissible = true,
    bool enableDrag = true,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      isDismissible: isDismissible,
      enableDrag: enableDrag,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.divider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            child,
          ],
        ),
      ),
    );
  }

  static void showSnackBar({
    required BuildContext context,
    required String message,
    bool isError = false,
    bool isSuccess = false,
    Duration duration = const Duration(seconds: 3),
    SnackBarAction? action,
  }) {
    Color backgroundColor = AppColors.textPrimary;
    if (isError) backgroundColor = AppColors.error;
    if (isSuccess) backgroundColor = AppColors.success;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(color: Colors.white)),
        backgroundColor: backgroundColor,
        duration: duration,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.all(16),
        action: action,
      ),
    );
  }

  // ── Private helper ────────────────────────────────────────────────────────
  static void _show({
    required BuildContext context,
    required IconData icon,
    required Color iconColor,
    required String title,
    required String message,
    required String buttonText,
    required Color buttonColor,
    VoidCallback? onPressed,
  }) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(icon, color: iconColor, size: 28),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                title,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        content: Text(
          message,
          style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: buttonColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () {
              Navigator.of(ctx).pop();
              (onPressed ?? () {})();
            },
            child: Text(buttonText),
          ),
        ],
      ),
    );
  }
}
