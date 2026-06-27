import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/services/storage_service.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/scholarship_application/screens/bfcsp_application_form_screen.dart';
import 'package:iskonnectttt/shared/widgets/custom_button.dart';
import 'package:iskonnectttt/shared/widgets/dialog_helper.dart';
import 'package:url_launcher/url_launcher.dart';

enum RequirementStatus {
  notSubmitted,
  submitted,
  underReview,
  approved,
  rejected,
  resubmitted,
}

extension RequirementStatusLabel on RequirementStatus {
  String get label {
    switch (this) {
      case RequirementStatus.notSubmitted:
        return 'Not submitted';
      case RequirementStatus.submitted:
        return 'Submitted';
      case RequirementStatus.underReview:
        return 'Under review';
      case RequirementStatus.approved:
        return 'Approved';
      case RequirementStatus.rejected:
        return 'Rejected';
      case RequirementStatus.resubmitted:
        return 'Resubmitted';
    }
  }

  Color color() {
    switch (this) {
      case RequirementStatus.notSubmitted:
        return AppColors.textSecondary;
      case RequirementStatus.submitted:
      case RequirementStatus.resubmitted:
        return AppColors.primary;
      case RequirementStatus.underReview:
        return AppColors.warning;
      case RequirementStatus.approved:
        return AppColors.success;
      case RequirementStatus.rejected:
        return AppColors.error;
    }
  }
}

class ApplicationRequirement {
  final String id;
  final String title;
  final String description;
  final bool isRequired;
  final String? fileName;
  final String? filePath;
  final String? fileUrl;
  final int? fileSize;
  final DateTime? submittedAt;
  final DateTime? reviewedAt;
  final String? reviewNotes;
  final RequirementStatus status;

  ApplicationRequirement({
    required this.id,
    required this.title,
    required this.description,
    this.isRequired = true,
    this.fileName,
    this.filePath,
    this.fileUrl,
    this.fileSize,
    this.submittedAt,
    this.reviewedAt,
    this.reviewNotes,
    this.status = RequirementStatus.notSubmitted,
  });

  bool get isSubmitted =>
      fileName != null && status != RequirementStatus.notSubmitted;

  String get fileSizeFormatted {
    if (fileSize == null) return '';
    if (fileSize! < 1024) return '$fileSize B';
    if (fileSize! < 1024 * 1024) {
      return '${(fileSize! / 1024).toStringAsFixed(1)} KB';
    }
    return '${(fileSize! / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  ApplicationRequirement copyWith({
    String? fileName,
    String? filePath,
    String? fileUrl,
    int? fileSize,
    DateTime? submittedAt,
    DateTime? reviewedAt,
    String? reviewNotes,
    RequirementStatus? status,
    bool clearSubmission = false,
  }) {
    return ApplicationRequirement(
      id: id,
      title: title,
      description: description,
      isRequired: isRequired,
      fileName: clearSubmission ? null : fileName ?? this.fileName,
      filePath: clearSubmission ? null : filePath ?? this.filePath,
      fileUrl: clearSubmission ? null : fileUrl ?? this.fileUrl,
      fileSize: clearSubmission ? null : fileSize ?? this.fileSize,
      submittedAt: clearSubmission ? null : submittedAt ?? this.submittedAt,
      reviewedAt: clearSubmission ? null : reviewedAt ?? this.reviewedAt,
      reviewNotes: clearSubmission ? null : reviewNotes ?? this.reviewNotes,
      status: clearSubmission ? RequirementStatus.notSubmitted : status ?? this.status,
    );
  }
}

final applicationRequirementsProvider =
    StateNotifierProvider<ApplicationRequirementsNotifier, List<ApplicationRequirement>>((ref) {
      return ApplicationRequirementsNotifier();
    });

class ApplicationRequirementsNotifier
    extends StateNotifier<List<ApplicationRequirement>> {
  ApplicationRequirementsNotifier() : super(_getInitialRequirements());

  static List<ApplicationRequirement> _getInitialRequirements() {
    return [
      ApplicationRequirement(
        id: '1',
        title: 'Application Form',
        description: 'Fully accomplished scholarship application form',
      ),
      ApplicationRequirement(
        id: '2',
        title: 'Certificate of Enrollment / Registration',
        description: 'Current semester COR from your school',
      ),
      ApplicationRequirement(
        id: '3',
        title: 'Report Card / Transcript of Records',
        description: 'Latest grades from previous semester',
      ),
      ApplicationRequirement(
        id: '4',
        title: 'Certificate of Good Moral Character',
        description: 'Issued by your school registrar or guidance office',
      ),
      ApplicationRequirement(
        id: '5',
        title: 'PSA Birth Certificate',
        description: 'Original or certified true copy from PSA',
      ),
      ApplicationRequirement(
        id: '6',
        title: '2x2 ID Photo',
        description: 'Recent photo with white background',
      ),
      ApplicationRequirement(
        id: '7',
        title: 'Barangay Certificate / Proof of Residency',
        description: 'Certificate from your barangay',
      ),
      ApplicationRequirement(
        id: '8',
        title: 'Parent/Guardian Income Certificate',
        description: 'Certificate of Employment with Income or ITR',
      ),
    ];
  }

  void markAsSubmitted(
    String id,
    String fileName, {
    String? filePath,
    String? fileUrl,
    int? fileSize,
  }) {
    state = state.map((req) {
      if (req.id != id) {
        return req;
      }

      final nextStatus = req.status == RequirementStatus.rejected ||
              req.status == RequirementStatus.submitted ||
              req.status == RequirementStatus.resubmitted
          ? RequirementStatus.resubmitted
          : RequirementStatus.submitted;

      return req.copyWith(
        fileName: fileName,
        filePath: filePath,
        fileUrl: fileUrl,
        fileSize: fileSize,
        submittedAt: DateTime.now(),
        status: nextStatus,
      );
    }).toList();
  }

  void removeSubmission(String id) {
    state = state.map((req) {
      if (req.id == id) {
        return req.copyWith(clearSubmission: true);
      }
      return req;
    }).toList();
  }

  void updateStatus(String id, RequirementStatus status, {String? reviewNotes}) {
    state = state.map((req) {
      if (req.id != id) {
        return req;
      }
      return req.copyWith(
        status: status,
        reviewNotes: reviewNotes,
        reviewedAt: DateTime.now(),
      );
    }).toList();
  }

  int get requiredCount => state.where((r) => r.isRequired).length;

  int get requiredSubmittedCount => state
      .where((r) => r.isRequired && r.isSubmitted && r.status != RequirementStatus.rejected)
      .length;

  bool get hasRejectedRequired =>
      state.any((r) => r.isRequired && r.status == RequirementStatus.rejected);

  bool get canSubmitApplication =>
      requiredSubmittedCount == requiredCount && !hasRejectedRequired;
}

// Maps each local requirement onto the admin panel's requirement keys so the
// City Education Department admin can see what was submitted. Built from the
// current requirement state and persisted to the applicant's user doc.
const _adminKeyById = {
  '1': 'applicationForm',
  '2': 'idPictures',
  '3': 'form137',
  '4': 'goodMoral',
  '5': 'votersId',
  '6': 'barangayResidency',
  '7': 'electricBills',
  '8': 'cedula',
};

Map<String, dynamic> _buildRequirementsMap(List<ApplicationRequirement> requirements) {
  final map = <String, dynamic>{};
  for (final req in requirements) {
    final key = _adminKeyById[req.id];
    if (key == null) continue;
    map[key] = {
      'submitted': req.isSubmitted,
      'status': req.status.name,
      'fileName': req.fileName,
      'fileUrl': req.fileUrl,
      'title': req.title,
    };
  }
  return map;
}

class ScholarshipApplicationScreen extends ConsumerWidget {
  const ScholarshipApplicationScreen({super.key});

  // Persists the current requirement state to the applicant's Firestore user
  // doc. Called after every submit/remove so the admin sees an applicant as
  // soon as they've submitted one or more requirements — not only after the
  // final "Submit Application" step.
  Future<void> _persistRequirements(WidgetRef ref) async {
    final requirements = ref.read(applicationRequirementsProvider);
    await ref
        .read(authStateProvider.notifier)
        .saveApplicationRequirements(_buildRequirementsMap(requirements));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requirements = ref.watch(applicationRequirementsProvider);
    final notifier = ref.watch(applicationRequirementsProvider.notifier);
    final authState = ref.watch(authStateProvider);

    final requiredReqs = requirements.where((r) => r.isRequired).toList();
    final requiredSubmitted = notifier.requiredSubmittedCount;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Scholarship Application',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.primaryDark, AppColors.primary],
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _ProgressCard(
                submittedCount: requiredSubmitted,
                requiredCount: notifier.requiredCount,
                hasRejectedRequired: notifier.hasRejectedRequired,
              ),
            ),
            const SizedBox(height: 16),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                'Required Documents',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                children: requiredReqs
                    .map(
                      (req) => _RequirementCard(
                        requirement: req,
                        onUpload: () => _handleUpload(context, ref, req),
                        onEdit: () => _handleUpload(context, ref, req),
                        onRemove: () async {
                          notifier.removeSubmission(req.id);
                          await _persistRequirements(ref);
                        },
                        onView: () => _showDocumentDetails(context, req),
                        uploadLabel: req.id == '1' ? 'Fill Out Form' : 'Upload',
                        uploadIcon: req.id == '1' ? Icons.edit_document : Icons.upload_file_outlined,
                      ),
                    )
                    .toList(),
              ),
            ),
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: CustomButton(
                text: 'Submit Application',
                onPressed: () => _submitApplication(context, ref),
                isLoading: authState.isLoading,
              ),
            ),
            const SizedBox(height: 10),
            if (!notifier.canSubmitApplication)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: const [
                    Icon(Icons.info_outline, size: 14, color: AppColors.textSecondary),
                    SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Some documents are missing or rejected. You may still submit — staff will review.',
                        style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Future<void> _handleUpload(
    BuildContext context,
    WidgetRef ref,
    ApplicationRequirement requirement,
  ) async {
    // Application Form (id '1') opens the multi-step BFCSP form instead of file picker
    if (requirement.id == '1') {
      final authStudent = ref.read(authStateProvider).student;
      final submitted = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => BfcspApplicationFormScreen(
            userId: authStudent?.id,
            student: authStudent,
          ),
        ),
      );
      if (submitted == true) {
        ref.read(applicationRequirementsProvider.notifier).markAsSubmitted(
          '1',
          'BFCSP Application Form (submitted)',
          fileSize: 0,
        );
        await _persistRequirements(ref);
      }
      return;
    }

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.any,
        allowMultiple: false,
        withData: true,
      );

      if (result == null || result.files.isEmpty) {
        return;
      }

      final file = result.files.first;

      // Reject anything larger than the upload limit before doing the work.
      if (file.size > StorageService.maxFileBytes) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('File is too large. Maximum size is 10 MB.'),
              backgroundColor: AppColors.error,
            ),
          );
        }
        return;
      }

      // Upload the file (any type — PDF, image, document) to Firebase Storage so
      // the admin can view/download it.
      String? fileUrl;
      if (file.bytes != null) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Uploading ${requirement.title}...'),
              duration: const Duration(seconds: 1),
            ),
          );
        }
        final studentId = ref.read(currentStudentProvider)?.id ?? '';
        fileUrl = await StorageService.uploadRequirementFile(
          studentId: studentId,
          requirementId: requirement.id,
          fileName: file.name,
          bytes: file.bytes!,
        );
      }

      ref.read(applicationRequirementsProvider.notifier).markAsSubmitted(
            requirement.id,
            file.name,
            filePath: kIsWeb ? null : file.path,
            fileUrl: fileUrl,
            fileSize: file.size,
          );
      await _persistRequirements(ref);

      if (context.mounted) {
        final didUpload = fileUrl != null;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(didUpload
                ? '${requirement.title} uploaded successfully.'
                : '${requirement.title} saved (file could not be uploaded to storage).'),
            backgroundColor:
                didUpload ? AppColors.success : AppColors.warning,
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to pick file: ${e.toString()}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  static bool _isImageFile(ApplicationRequirement req) {
    final name = (req.fileName ?? '').toLowerCase();
    final url = (req.fileUrl ?? '').toLowerCase();
    final isImageExt = RegExp(r'\.(png|jpe?g|gif|webp|bmp)$').hasMatch(name);
    // Cloudinary serves images under /image/upload/.
    return isImageExt || url.contains('/image/upload/');
  }

  Future<void> _openFileUrl(BuildContext context, String url) async {
    final ok = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    );
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open the file.')),
      );
    }
  }

  void _showDocumentDetails(BuildContext context, ApplicationRequirement req) {
    final hasFile = req.fileUrl != null && req.fileUrl!.isNotEmpty;
    final isImage = hasFile && _isImageFile(req);

    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text(req.title),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Show the actual submitted file: image inline, others as a
                // tappable card that opens/downloads the real file.
                if (isImage)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.network(
                      req.fileUrl!,
                      fit: BoxFit.contain,
                      loadingBuilder: (c, child, progress) => progress == null
                          ? child
                          : const Padding(
                              padding: EdgeInsets.all(24),
                              child: Center(child: CircularProgressIndicator()),
                            ),
                      errorBuilder: (c, e, s) => _FilePlaceholder(
                        label: 'Could not load image. Tap "Open file" below.',
                      ),
                    ),
                  )
                else if (hasFile)
                  InkWell(
                    onTap: () => _openFileUrl(dialogContext, req.fileUrl!),
                    child: _FilePlaceholder(
                      label: req.fileName ?? 'Open file',
                      icon: Icons.insert_drive_file_outlined,
                    ),
                  )
                else
                  _FilePlaceholder(
                    label: 'No uploaded file is available to preview.',
                    icon: Icons.cloud_off_outlined,
                  ),
                const SizedBox(height: 14),
                _DetailRow(label: 'Status', value: req.status.label),
                _DetailRow(label: 'File', value: req.fileName ?? 'N/A'),
                _DetailRow(
                  label: 'Size',
                  value: req.fileSizeFormatted.isEmpty ? 'N/A' : req.fileSizeFormatted,
                ),
                _DetailRow(
                  label: 'Submitted At',
                  value: req.submittedAt?.toIso8601String() ?? 'N/A',
                ),
                if (req.reviewNotes != null && req.reviewNotes!.isNotEmpty)
                  _DetailRow(label: 'Review Notes', value: req.reviewNotes!),
              ],
            ),
          ),
          actions: [
            if (hasFile)
              TextButton.icon(
                onPressed: () => _openFileUrl(dialogContext, req.fileUrl!),
                icon: const Icon(Icons.open_in_new, size: 18),
                label: const Text('Open file'),
              ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Close'),
            ),
          ],
        );
      },
    );
  }

  void _submitApplication(BuildContext context, WidgetRef ref) {
    DialogHelper.showConfirmDialog(
      context: context,
      title: 'Submit Application',
      message:
          'Submit your scholarship application now? You can still resubmit documents if an evaluator rejects a requirement.',
      confirmText: 'Submit',
      onConfirm: () async {
        // Build a requirements map keyed by the admin panel's requirement keys
        // so the City Education Department admin can see what was submitted.
        final requirements = ref.read(applicationRequirementsProvider);
        final requirementsMap = _buildRequirementsMap(requirements);

        await ref.read(authStateProvider.notifier).updateApplicationStatus('submitted');
        await ref
            .read(authStateProvider.notifier)
            .saveApplicationRequirements(requirementsMap);

        if (!context.mounted) {
          return;
        }

        DialogHelper.showSuccessDialog(
          context: context,
          title: 'Application Submitted',
          message:
              'Your application is now in submitted status. You can track each requirement status as it moves to review and approval.',
          onPressed: () {
            context.go('/dashboard');
          },
        );
      },
    );
  }
}

class _ProgressCard extends StatelessWidget {
  final int submittedCount;
  final int requiredCount;
  final bool hasRejectedRequired;

  const _ProgressCard({
    required this.submittedCount,
    required this.requiredCount,
    required this.hasRejectedRequired,
  });

  @override
  Widget build(BuildContext context) {
    final progress = requiredCount == 0 ? 0.0 : submittedCount / requiredCount;
    final isComplete = submittedCount >= requiredCount && !hasRejectedRequired;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isComplete
              ? [AppColors.success, const Color(0xFF16A34A)]
              : [AppColors.primary, AppColors.primaryLight],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: (isComplete ? AppColors.success : AppColors.primary)
                .withValues(alpha: 0.25),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  isComplete ? Icons.task_alt_rounded : Icons.checklist_rounded,
                  color: Colors.white,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  isComplete ? 'All Documents Ready!' : 'Application Progress',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Colors.white.withValues(alpha: 0.95),
                    letterSpacing: 0.2,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${(progress * 100).toInt()}%',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$submittedCount',
                style: const TextStyle(
                  fontSize: 42,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  height: 1,
                  letterSpacing: -1,
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  ' / $requiredCount',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: Colors.white.withValues(alpha: 0.65),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  'documents',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white.withValues(alpha: 0.7),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: Colors.white.withValues(alpha: 0.2),
              valueColor: AlwaysStoppedAnimation<Color>(
                isComplete ? Colors.white : AppColors.secondary,
              ),
            ),
          ),
          if (hasRejectedRequired) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.warning_amber_rounded, color: Colors.white, size: 16),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Some files were rejected — please edit and resubmit.',
                      style: TextStyle(fontSize: 12, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _RequirementCard extends StatelessWidget {
  final ApplicationRequirement requirement;
  final VoidCallback onUpload;
  final VoidCallback onEdit;
  final VoidCallback onRemove;
  final VoidCallback onView;
  final String uploadLabel;
  final IconData uploadIcon;

  const _RequirementCard({
    required this.requirement,
    required this.onUpload,
    required this.onEdit,
    required this.onRemove,
    required this.onView,
    this.uploadLabel = 'Upload',
    this.uploadIcon = Icons.upload_file_outlined,
  });

  bool get _isApplicationForm => uploadLabel == 'Fill Out Form';

  @override
  Widget build(BuildContext context) {
    final accentColor = _getBorderColor();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accentColor.withValues(alpha: 0.35)),
        boxShadow: [
          BoxShadow(
            color: accentColor.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Left accent strip
              Container(
                width: 5,
                decoration: BoxDecoration(
                  color: accentColor,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(16),
                    bottomLeft: Radius.circular(16),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: requirement.status.color().withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(
                              _isApplicationForm
                                  ? Icons.article_outlined
                                  : requirement.isSubmitted
                                      ? Icons.insert_drive_file_outlined
                                      : Icons.upload_file_outlined,
                              color: requirement.status.color(),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        requirement.title,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.textPrimary,
                                          height: 1.3,
                                        ),
                                      ),
                                    ),
                                    if (requirement.isRequired)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: AppColors.error.withValues(alpha: 0.1),
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: const Text(
                                          'Required',
                                          style: TextStyle(
                                            fontSize: 10,
                                            color: AppColors.error,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  requirement.description,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textSecondary,
                                    height: 1.4,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: [
                          _StatusChip(status: requirement.status),
                          if (requirement.fileName != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceVariant,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.description_outlined, size: 14, color: AppColors.textSecondary),
                                  const SizedBox(width: 4),
                                  Text(
                                    requirement.fileSize != null
                                        ? '${requirement.fileName} (${requirement.fileSizeFormatted})'
                                        : requirement.fileName!,
                                    style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _buildActions(),
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

  List<Widget> _buildActions() {
    if (!requirement.isSubmitted) {
      return [
        _ActionButton(
          icon: uploadIcon,
          label: uploadLabel,
          onPressed: onUpload,
          isPrimary: true,
        ),
      ];
    }

    final canEdit = requirement.status != RequirementStatus.approved &&
        requirement.status != RequirementStatus.underReview;

    return [
      _ActionButton(icon: Icons.visibility_outlined, label: 'View', onPressed: onView),
      _ActionButton(
        icon: Icons.edit_outlined,
        label: 'Edit',
        onPressed: canEdit ? onEdit : null,
      ),
      _ActionButton(
        icon: Icons.delete_outline,
        label: 'Remove',
        onPressed: canEdit ? onRemove : null,
      ),
    ];
  }

  Color _getBorderColor() {
    if (!requirement.isSubmitted) {
      return AppColors.border;
    }

    if (requirement.status == RequirementStatus.rejected) {
      return AppColors.error.withValues(alpha: 0.5);
    }

    if (requirement.status == RequirementStatus.approved) {
      return AppColors.success.withValues(alpha: 0.5);
    }

    return requirement.status.color().withValues(alpha: 0.35);
  }
}

class _StatusChip extends StatelessWidget {
  final RequirementStatus status;

  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = status.color();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.label,
        style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final bool isPrimary;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.isPrimary = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isPrimary && onPressed != null) {
      return ElevatedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 16),
        label: Text(label),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          visualDensity: VisualDensity.compact,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        ),
      );
    }
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: onPressed == null ? AppColors.textSecondary : AppColors.primary,
        side: BorderSide(
          color: onPressed == null
              ? AppColors.border
              : AppColors.primary.withValues(alpha: 0.45),
        ),
        visualDensity: VisualDensity.compact,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}

/// A bordered card used in the document dialog when there's no inline image to
/// show (non-image file, load error, or no uploaded file).
class _FilePlaceholder extends StatelessWidget {
  final String label;
  final IconData icon;

  const _FilePlaceholder({
    required this.label,
    this.icon = Icons.image_not_supported_outlined,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Icon(icon, size: 36, color: AppColors.textSecondary),
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(color: AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}
