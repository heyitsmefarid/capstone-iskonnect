import 'package:flutter/material.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';

class DialogHelper {
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
