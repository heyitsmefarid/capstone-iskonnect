import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:file_picker/file_picker.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/features/requirements/providers/requirements_provider.dart';
import 'package:iskonnectttt/shared/widgets/dialog_helper.dart';

class RequirementsScreen extends ConsumerWidget {
  const RequirementsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requirements = ref.watch(requirementsProvider);
    final summary = ref.watch(requirementsSummaryProvider);

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
                                '${(summary.progress * 100).toInt()}%',
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
                              '${summary.verified}/${summary.total}',
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
                          widthFactor: summary.progress,
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
                              count: summary.pending,
                              color: const Color(0xFFFBBF24),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: _CompactStatusChip(
                              label: 'Missing',
                              count: summary.notSubmitted,
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
    String requirementName,
  ) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
      );

      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;

        // Check file size (max 5MB)
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

        // Simulate upload
        ref
            .read(requirementsProvider.notifier)
            .uploadDocument(
              requirementId: requirementName,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.extension ?? 'unknown',
            );

        if (context.mounted) {
          DialogHelper.showSuccessDialog(
            context: context,
            title: 'Upload Successful',
            message: '${file.name} has been submitted for verification.',
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        DialogHelper.showErrorDialog(
          context: context,
          title: 'Upload Failed',
          message: 'An error occurred while uploading. Please try again.',
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
    this.uploadDate,
    this.remarks,
    required this.onUpload,
    required this.onReupload,
  });

  Color _getStatusColor() {
    switch (status.toLowerCase()) {
      case 'verified':
        return AppColors.success;
      case 'pending':
        return AppColors.warning;
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
      case 'pending':
        return Icons.hourglass_empty;
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
    final bool isSubmitted = status.toLowerCase() != 'not submitted';
    final bool canReupload = status.toLowerCase() == 'rejected';

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

          if (isSubmitted && fileName != null) ...[
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
                color: status.toLowerCase() == 'rejected'
                    ? AppColors.errorLight
                    : AppColors.infoLight,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.comment,
                    size: 12,
                    color: status.toLowerCase() == 'rejected'
                        ? AppColors.error
                        : AppColors.info,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      remarks!,
                      style: TextStyle(
                        fontSize: 11,
                        color: status.toLowerCase() == 'rejected'
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
          if (!isSubmitted)
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
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onReupload,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Re-upload', style: TextStyle(fontSize: 13)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.warning,
                  side: const BorderSide(color: AppColors.warning),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            )
          else
            Row(
              children: [
                Icon(
                  Icons.check_circle_outline,
                  size: 14,
                  color: _getStatusColor(),
                ),
                const SizedBox(width: 4),
                Text(
                  status.toLowerCase() == 'verified' ? 'Verified' : 'Pending',
                  style: TextStyle(fontSize: 11, color: _getStatusColor()),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
