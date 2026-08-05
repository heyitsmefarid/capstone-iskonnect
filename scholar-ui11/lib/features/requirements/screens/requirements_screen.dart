import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:iskonnectttt/core/models/requirement_model.dart';
import 'package:iskonnectttt/core/services/scholar_firestore_service.dart';
import 'package:iskonnectttt/core/services/storage_service.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/features/requirements/providers/requirements_provider.dart';
import 'package:iskonnectttt/shared/widgets/dialog_helper.dart';
import 'package:iskonnectttt/shared/widgets/inline_pdf_preview.dart';

class RequirementsScreen extends ConsumerWidget {
  const RequirementsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requirementsAsync = ref.watch(firestoreRequirementsListProvider);
    final isLoading = requirementsAsync.isLoading;
    final requirements = requirementsAsync.asData?.value ?? const [];
    // Attached but not yet sent — what the Submit button will promote.
    final stagedRequirements =
        requirements.where((r) => r.status == 'Uploaded').toList();
    final summary = RequirementsSummary.fromRequirements(requirements);
    // "Complete" reflects documents that have been turned in (submitted or
    // already verified), not just admin-verified ones — otherwise the bar
    // stays at 0% until the admin reviews everything.
    final completedCount = summary.submitted + summary.verified;
    final progress =
        summary.total > 0 ? completedCount / summary.total : 0.0;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // Modern Header
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: Row(
                  children: [
                    _ModernBackButton(onTap: () => context.go('/dashboard')),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Requirements',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                              letterSpacing: -0.5,
                            ),
                          ),
                          Text(
                            'Upload your documents',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ).animate().fadeIn(duration: 400.ms).slideX(begin: -0.1),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 8)),

            // Progress Card - Compact Design
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppColors.mustard, AppColors.mustardLight],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.primary, width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.mustard.withValues(alpha: 0.3),
                        blurRadius: 16,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${(progress * 100).toInt()}%',
                                style: const TextStyle(
                                  fontSize: 32,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                'Complete',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.white.withValues(alpha: 0.8),
                                ),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '$completedCount/${summary.total}',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      // Progress Bar
                      Container(
                        height: 8,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: progress,
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: _CompactStatusChip(
                              label: 'Verified',
                              count: summary.verified,
                              color: const Color(0xFF4ADE80),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: _CompactStatusChip(
                              label: 'Pending',
                              count: summary.submitted,
                              color: const Color(0xFFFBBF24),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: _CompactStatusChip(
                              label: 'Missing',
                              count: summary.pending,
                              color: const Color(0xFFF87171),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 12)),

            // Info Card - Compact
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.lavender.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppColors.lavender.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.info_outline_rounded,
                        color: AppColors.lavender,
                        size: 18,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Upload PDF, JPG, PNG (max 5MB)',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.lavender,
                          ),
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(delay: 300.ms),
              ),
            ),

            // Section Header
            const SliverToBoxAdapter(child: SizedBox(height: 16)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: const Text(
                  'Required Documents',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.3,
                  ),
                ).animate().fadeIn(delay: 350.ms),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 10)),

            // Loading indicator while Firestore data is being fetched
            if (isLoading && requirements.isEmpty)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  child: LinearProgressIndicator(),
                ),
              ),

            // Requirements List
            SliverList(
              delegate: SliverChildBuilderDelegate((context, index) {
                final requirement = requirements[index];
                return _RequirementCard(
                      name: requirement.name,
                      description: requirement.description,
                      status: requirement.status,
                      fileName: requirement.fileName,
                      fileSize: requirement.fileSize,
                      fileUrl: requirement.fileUrl,
                      uploadDate: requirement.uploadDate,
                      remarks: requirement.remarks,
                      onUpload: () =>
                          _handleUpload(context, ref, requirement.id),
                      onReupload: () =>
                          _handleUpload(context, ref, requirement.id),
                    )
                    .animate()
                    .fadeIn(delay: Duration(milliseconds: 400 + (index * 50)))
                    .slideY(
                      begin: 0.05,
                      delay: Duration(milliseconds: 400 + (index * 50)),
                    );
              }, childCount: requirements.length),
            ),

            // Submit action — the only thing that sends documents to the
            // reviewers. Shown only while something is staged, so it cannot be
            // pressed with nothing to send.
            if (stagedRequirements.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        '${stagedRequirements.length} document'
                        '${stagedRequirements.length == 1 ? '' : 's'} ready to submit',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 12.5,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      ElevatedButton.icon(
                        onPressed: () =>
                            _handleSubmitAll(context, ref, stagedRequirements),
                        icon: const Icon(Icons.send_rounded, size: 18),
                        label: const Text('Submit Requirements'),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(delay: 450.ms),
              ),

            // Bottom Padding
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }

  Future<void> _handleUpload(
    BuildContext context,
    WidgetRef ref,
    String requirementId,
  ) async {
    final navigator = Navigator.of(context, rootNavigator: true);
    var progressShown = false;

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
        withData: true, // needed so we have the bytes to upload on web
      );

      if (result == null || result.files.isEmpty) return;
      final file = result.files.first;

      if (file.size > 5 * 1024 * 1024) {
        if (context.mounted) {
          DialogHelper.showErrorDialog(
            context: context,
            title: 'File Too Large',
            message: 'Please select a file smaller than 5MB.',
          );
        }
        return;
      }

      // Let the user preview the chosen image (or confirm the PDF) before it is
      // uploaded, so they can catch a wrong pick before it's submitted.
      if (context.mounted) {
        final confirmed = await DialogHelper.showFilePreviewConfirm(
          context: context,
          fileName: file.name,
          fileSize: file.size,
          bytes: file.bytes,
        );
        if (!confirmed) return;
      }

      final studentId = await ScholarFirestoreService.currentStudentId();
      if (studentId == null) {
        if (context.mounted) {
          DialogHelper.showErrorDialog(
            context: context,
            title: 'Not Signed In',
            message: 'Please sign in again before uploading.',
          );
        }
        return;
      }

      // Blocking spinner while the file uploads — Cloudinary uploads can take a
      // few seconds and we don't want the user tapping Upload again.
      if (context.mounted) {
        progressShown = true;
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (_) => const Center(child: CircularProgressIndicator()),
        );
      }

      // Upload the actual file so it can be viewed later by the scholar and the
      // admin. Without this only the file name would be stored (nothing to open).
      String? fileUrl;
      final bytes = file.bytes;
      if (bytes != null) {
        fileUrl = await StorageService.uploadRequirementFile(
          studentId: studentId,
          requirementId: requirementId,
          fileName: file.name,
          bytes: bytes,
        );
      }

      // Staged only — NOT submitted. Uploading used to write
      // status:'submitted'/submitted:true here, so picking a file instantly
      // sent it to the reviewers with no way back. The applicant now presses
      // "Submit Requirements" to promote staged files (see _handleSubmitAll).
      await ScholarFirestoreService.updateStudentRequirement(
        studentId,
        requirementId,
        {
          'status': 'uploaded',
          'submitted': false,
          'fileName': file.name,
          'fileSize': file.size,
          'fileType': file.extension ?? 'unknown',
          'fileUrl': fileUrl,
          'uploadedAt': DateTime.now().toIso8601String(),
          'submittedAt': null,
        },
      );
      // Force the Firestore provider to re-read so the screen reflects the
      // newly submitted document without requiring a manual refresh.
      ref.invalidate(firestoreRequirementsListProvider);

      // Dismiss the spinner before showing the result dialog.
      if (progressShown) {
        navigator.pop();
        progressShown = false;
      }

      if (!context.mounted) return;
      if (fileUrl == null && bytes != null) {
        DialogHelper.showErrorDialog(
          context: context,
          title: 'Upload Issue',
          message:
              'Your file was attached, but it could not be uploaded for viewing. Please try uploading it again.',
        );
      } else {
        DialogHelper.showSuccessDialog(
          context: context,
          title: 'File Attached',
          message:
              '${file.name} is ready. Press "Submit Requirements" to send your documents for verification.',
        );
      }
    } catch (e) {
      if (progressShown) navigator.pop();
      if (context.mounted) {
        DialogHelper.showErrorDialog(
          context: context,
          title: 'Upload Failed',
          message: 'An error occurred while uploading. Please try again.',
        );
      }
    }
  }

  /// Asks for confirmation, then promotes staged documents. `showConfirmDialog`
  /// is callback-based rather than awaitable, so the work lives in
  /// [_submitStaged] and runs from its `onConfirm`.
  void _handleSubmitAll(
    BuildContext context,
    WidgetRef ref,
    List<RequirementModel> staged,
  ) {
    DialogHelper.showConfirmDialog(
      context: context,
      title: 'Submit Requirements',
      message:
          'Submit ${staged.length} document${staged.length == 1 ? '' : 's'} for verification? '
          'You will not be able to change them afterwards unless a reviewer returns one.',
      confirmText: 'Submit',
      onConfirm: () => _submitStaged(context, ref, staged),
    );
  }

  /// Promotes every staged ("uploaded") document to submitted. This is the only
  /// place a requirement becomes visible to reviewers.
  Future<void> _submitStaged(
    BuildContext context,
    WidgetRef ref,
    List<RequirementModel> staged,
  ) async {
    // Captured before any await, and paired with progressShown, so the spinner
    // is only ever popped if it was actually pushed. Popping unconditionally
    // would dismiss the screen itself whenever the dialog had been skipped.
    final navigator = Navigator.of(context, rootNavigator: true);
    var progressShown = false;

    try {
      final studentId = await ScholarFirestoreService.currentStudentId();
      if (studentId == null) {
        if (context.mounted) {
          DialogHelper.showErrorDialog(
            context: context,
            title: 'Not Signed In',
            message: 'Please sign in again before submitting.',
          );
        }
        return;
      }

      if (context.mounted) {
        progressShown = true;
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (_) => const Center(child: CircularProgressIndicator()),
        );
      }

      final now = DateTime.now().toIso8601String();
      for (final req in staged) {
        await ScholarFirestoreService.updateStudentRequirement(
          studentId,
          req.id,
          {
            'status': 'submitted',
            'submitted': true,
            'fileName': req.fileName,
            'fileSize': req.fileSize,
            'fileType': req.fileType,
            'fileUrl': req.fileUrl,
            'submittedAt': now,
          },
        );
      }
      ref.invalidate(firestoreRequirementsListProvider);
      ref.invalidate(firestoreRequirementsSummaryProvider);

      if (progressShown) {
        navigator.pop();
        progressShown = false;
      }
      if (context.mounted) {
        DialogHelper.showSuccessDialog(
          context: context,
          title: 'Submitted',
          message:
              '${staged.length} document${staged.length == 1 ? '' : 's'} sent for verification.',
        );
      }
    } catch (_) {
      if (progressShown) navigator.pop();
      if (context.mounted) {
        DialogHelper.showErrorDialog(
          context: context,
          title: 'Submission Failed',
          message: 'Could not submit your documents. Please try again.',
        );
      }
    }
  }
}

/// Modern back button widget
class _ModernBackButton extends StatelessWidget {
  final VoidCallback onTap;

  const _ModernBackButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider),
        boxShadow: [
          BoxShadow(
            color: AppColors.cardShadow.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: const Center(
            child: Icon(
              Icons.arrow_back_ios_new_rounded,
              size: 16,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}

/// Compact Status Chip
class _CompactStatusChip extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _CompactStatusChip({
    required this.label,
    required this.count,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Text(
            '$count',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: Colors.white.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }
}

class _RequirementCard extends StatelessWidget {
  final String name;
  final String description;
  final String status;
  final String? fileName;
  final int? fileSize;
  final String? fileUrl;
  final DateTime? uploadDate;
  final String? remarks;
  final VoidCallback onUpload;
  final VoidCallback onReupload;

  const _RequirementCard({
    required this.name,
    required this.description,
    required this.status,
    this.fileName,
    this.fileSize,
    this.fileUrl,
    this.uploadDate,
    this.remarks,
    required this.onUpload,
    required this.onReupload,
  });

  bool get _isImage {
    final n = (fileName ?? '').toLowerCase();
    final u = (fileUrl ?? '').toLowerCase();
    final isImageExt = RegExp(r'\.(png|jpe?g|gif|webp|bmp)$').hasMatch(n);
    return isImageExt ||
        u.startsWith('data:image') ||
        u.contains('/image/upload/');
  }

  /// Shows the submitted document inside the app. Hosted images and base64
  /// data-URI images render inline (Chrome blocks opening `data:` URLs as a new
  /// tab, so we can't just launch them); other file types open externally.
  void _showDocument(BuildContext context) {
    final url = fileUrl;
    if (url == null || url.isEmpty) return;

    showDialog<void>(
      context: context,
      builder: (dialogContext) => Dialog(
        insetPadding: const EdgeInsets.all(16),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640, maxHeight: 720),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        fileName ?? name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.of(dialogContext).pop(),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: _isImage
                    ? _buildImage(url)
                    : isPdfFile(fileName, url)
                        ? InlinePdfPreview(url: url)
                        : Padding(
                            padding: const EdgeInsets.all(28),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.insert_drive_file_outlined,
                                  size: 56,
                                  color: AppColors.primary,
                                ),
                                const SizedBox(height: 16),
                                ElevatedButton.icon(
                                  onPressed: () =>
                                      _openExternal(dialogContext, url),
                                  icon: const Icon(Icons.open_in_new, size: 18),
                                  label: const Text('Open file'),
                                ),
                              ],
                            ),
                          ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildImage(String url) {
    const errorWidget = Center(
      child: Padding(
        padding: EdgeInsets.all(28),
        child: Text('Could not load image.'),
      ),
    );

    if (url.startsWith('data:')) {
      final idx = url.indexOf('base64,');
      if (idx == -1) return errorWidget;
      try {
        final bytes = base64Decode(url.substring(idx + 'base64,'.length));
        return InteractiveViewer(
          child: Image.memory(
            bytes,
            fit: BoxFit.contain,
            errorBuilder: (_, _, _) => errorWidget,
          ),
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
                  child: CircularProgressIndicator(),
                ),
              ),
        errorBuilder: (_, _, _) => errorWidget,
      ),
    );
  }

  Future<void> _openExternal(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open the document.')),
      );
    }
  }

  Color _getStatusColor() {
    switch (status.toLowerCase()) {
      case 'verified':
        return AppColors.success;
      case 'submitted':
      case 'resubmitted':
      case 'under_review':
        return AppColors.warning;
      case 'uploaded':
        return AppColors.info;
      case 'rejected':
        return AppColors.error;
      default:
        return AppColors.textTertiary;
    }
  }

  IconData _getStatusIcon() {
    switch (status.toLowerCase()) {
      case 'verified':
        return Icons.verified;
      case 'submitted':
      case 'resubmitted':
      case 'under_review':
        return Icons.hourglass_empty;
      case 'uploaded':
        return Icons.attach_file_rounded;
      case 'rejected':
        return Icons.error;
      default:
        return Icons.upload_file;
    }
  }

  String _formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final normalized = status.toLowerCase();
    final bool isSubmitted = normalized == 'submitted' ||
        normalized == 'resubmitted' ||
        normalized == 'under_review' ||
        normalized == 'verified' ||
        normalized == 'rejected';
    // Attached but not yet submitted: the applicant can still view or swap the
    // file, and it is not with the reviewers.
    final bool isStaged = normalized == 'uploaded';
    final bool canReupload = normalized == 'rejected' || isStaged;
    final bool hasFile = fileUrl != null && fileUrl!.isNotEmpty;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: _getStatusColor().withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  _getStatusIcon(),
                  color: _getStatusColor(),
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      description,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: _getStatusColor().withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: _getStatusColor(),
                  ),
                ),
              ),
            ],
          ),

          if ((isSubmitted || isStaged) && fileName != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.description,
                    size: 16,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      fileName!,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (fileSize != null)
                    Text(
                      _formatFileSize(fileSize!),
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.textTertiary,
                      ),
                    ),
                ],
              ),
            ),
          ],

          if (remarks != null && remarks!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: normalized == 'rejected'
                    ? AppColors.errorLight
                    : AppColors.infoLight,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.comment,
                    size: 12,
                    color: normalized == 'rejected'
                        ? AppColors.error
                        : AppColors.info,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      remarks!,
                      style: TextStyle(
                        fontSize: 11,
                        color: normalized == 'rejected'
                            ? AppColors.error
                            : AppColors.info,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 10),
          // isStaged is excluded here so an attached-but-unsent document offers
          // View/Replace (the canReupload branch) instead of a bare Upload CTA
          // that would make it look like nothing had been attached.
          if (!isSubmitted && !isStaged)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onUpload,
                icon: const Icon(Icons.upload, size: 16),
                label: const Text('Upload', style: TextStyle(fontSize: 13)),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            )
          else if (canReupload)
            Row(
              children: [
                if (hasFile) ...[
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _showDocument(context),
                      icon: const Icon(Icons.visibility_outlined, size: 16),
                      label:
                          const Text('View', style: TextStyle(fontSize: 13)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        side: const BorderSide(color: AppColors.primary),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onReupload,
                    icon: const Icon(Icons.refresh, size: 16),
                    label: Text(
                      isStaged ? 'Replace' : 'Re-upload',
                      style: const TextStyle(fontSize: 13),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor:
                          isStaged ? AppColors.info : AppColors.warning,
                      side: BorderSide(
                        color: isStaged ? AppColors.info : AppColors.warning,
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
              ],
            )
          else if (hasFile)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _showDocument(context),
                icon: const Icon(Icons.visibility_outlined, size: 16),
                label: const Text(
                  'View Document',
                  style: TextStyle(fontSize: 13),
                ),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
