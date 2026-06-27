import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/models/grade_model.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/core/utils/validators.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/grades/providers/grades_provider.dart';
import 'package:iskonnectttt/shared/widgets/custom_app_bar.dart';
import 'package:iskonnectttt/shared/widgets/custom_button.dart';
import 'package:iskonnectttt/shared/widgets/custom_text_field.dart';
import 'package:iskonnectttt/shared/widgets/dialog_helper.dart';
import 'package:uuid/uuid.dart';

class AddGradeScreen extends ConsumerStatefulWidget {
  final bool corOnly;

  const AddGradeScreen({super.key, this.corOnly = false});

  @override
  ConsumerState<AddGradeScreen> createState() => _AddGradeScreenState();
}

class _AddGradeScreenState extends ConsumerState<AddGradeScreen> {
  final _formKey = GlobalKey<FormState>();
  final _subjectCodeController = TextEditingController();
  final _subjectNameController = TextEditingController();
  final _gradeController = TextEditingController();
  String _selectedSemester = '1st Semester';
  String _selectedAcademicYear = '2025-2026';
  int _selectedUnits = 3;
  String _selectedRemarks = 'Passed';
  bool _isLoading = false;

  final List<int> _units = [1, 2, 3, 4, 5, 6];
  final List<String> _remarksOptions = [
    'Passed',
    'Failed',
    'Incomplete',
    'Other',
  ];

  String get _selectedPeriodKey => buildAcademicPeriodKey(
    academicYear: _selectedAcademicYear,
    semester: _selectedSemester,
  );

  @override
  void initState() {
    super.initState();
    _loadActivePeriod();
  }

  // Auto-assign the active school year and semester (set by the admin).
  Future<void> _loadActivePeriod() async {
    try {
      final period = await ref.read(activeAcademicPeriodProvider.future);
      if (!mounted) return;
      setState(() {
        _selectedAcademicYear = period.schoolYear;
        _selectedSemester = period.semester;
      });
    } catch (_) {
      // Keep defaults.
    }
  }

  @override
  void dispose() {
    _subjectCodeController.dispose();
    _subjectNameController.dispose();
    _gradeController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    // COR is uploaded separately (Add COR screen) and is no longer required
    // when adding a subject.
    final gradeText = _gradeController.text.trim();
    double? parsedGrade;

    if (gradeText.isNotEmpty) {
      parsedGrade = double.tryParse(gradeText);
      if (parsedGrade == null) {
        DialogHelper.showWarningDialog(
          context: context,
          title: 'Invalid Grade',
          message: 'Please enter a valid numeric grade.',
        );
        return;
      }
    }

    setState(() => _isLoading = true);

    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 800));

    ref
        .read(gradesProvider.notifier)
        .addGrade(
          GradeModel(
            id: const Uuid().v4(),
            subjectCode: _subjectCodeController.text.trim().toUpperCase(),
            subjectName: _subjectNameController.text.trim(),
            semester: _selectedSemester,
            academicYear: _selectedAcademicYear,
            units: _selectedUnits,
            grade: parsedGrade,
            remarks: _selectedRemarks,
          ),
        );

    setState(() => _isLoading = false);

    if (mounted) {
      DialogHelper.showSuccessDialog(
        context: context,
        title: 'Subject Added',
        message:
            'Your subject ${_subjectCodeController.text.toUpperCase()} has been recorded.',
        onPressed: () => context.pop(),
      );
    }
  }

  Future<void> _handleCorUpload() async {
    try {
      // FileType.any is the most reliable on Flutter web; we validate the
      // extension ourselves below.
      final result = await FilePicker.platform.pickFiles(
        type: FileType.any,
        withData: true,
      );

      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;

      final ext = (file.extension ?? file.name.split('.').last).toLowerCase();
      const allowed = ['pdf', 'jpg', 'jpeg', 'png'];
      if (!allowed.contains(ext)) {
        if (mounted) {
          DialogHelper.showErrorDialog(
            context: context,
            title: 'Unsupported File',
            message: 'Please upload a PDF, JPG, or PNG file.',
          );
        }
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        if (mounted) {
          DialogHelper.showErrorDialog(
            context: context,
            title: 'File Too Large',
            message: 'Please select a file smaller than 5MB.',
          );
        }
        return;
      }

      ref
          .read(corSubmissionsProvider.notifier)
          .submitCor(
            academicYear: _selectedAcademicYear,
            semester: _selectedSemester,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.extension ?? 'unknown',
            // On web, accessing file.path throws — guard it.
            filePath: kIsWeb ? null : file.path,
            fileBytes: file.bytes,
          );

      if (mounted) {
        DialogHelper.showSuccessDialog(
          context: context,
          title: 'COR Uploaded',
          message:
              '${file.name} has been uploaded for $_selectedSemester, A.Y. $_selectedAcademicYear.',
        );
      }
    } catch (_) {
      if (mounted) {
        DialogHelper.showErrorDialog(
          context: context,
          title: 'Upload Failed',
          message: 'An error occurred while uploading your COR.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final student = ref.watch(currentStudentProvider);
    final isCorRequired = !(student?.isStAugustine ?? false);
    final corSubmissions = ref.watch(corSubmissionsProvider);
    final corSubmission = corSubmissions[_selectedPeriodKey];

    return Scaffold(
      appBar: CustomAppBar(title: widget.corOnly ? 'Add COR' : 'Add Subject'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Info Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.infoLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.info.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.info_outline,
                      color: AppColors.info,
                      size: 20,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        widget.corOnly
                            ? 'Upload your Certificate of Registration for the selected semester.'
                            : 'Add your subject details. You can also provide a grade now if available.',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.info,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              if (!widget.corOnly) ...[
                // Subject Info Section
                const Text(
                  'Subject Information',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: _subjectCodeController,
                  label: 'Subject Code',
                  hint: 'e.g., IT 101',
                  prefixIcon: Icons.code,
                  validator: Validators.required,
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: _subjectNameController,
                  label: 'Subject Name',
                  hint: 'e.g., Introduction to Computing',
                  prefixIcon: Icons.book,
                  validator: Validators.required,
                ),
                const SizedBox(height: 16),
                CustomTextField(
                  controller: _gradeController,
                  label: 'Grade (Optional)',
                  hint: 'e.g., 1.50',
                  prefixIcon: Icons.grade_outlined,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                ),
                const SizedBox(height: 16),
                CustomDropdown<int>(
                  label: 'Units',
                  value: _selectedUnits,
                  items: _units
                      .map(
                        (u) => DropdownMenuItem(
                          value: u,
                          child: Text('$u ${u == 1 ? 'unit' : 'units'}'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    setState(() => _selectedUnits = value ?? _selectedUnits);
                  },
                ),
                const SizedBox(height: 16),
                CustomDropdown<String>(
                  label: 'Remarks',
                  value: _selectedRemarks,
                  items: _remarksOptions
                      .map(
                        (r) => DropdownMenuItem(value: r, child: Text(r)),
                      )
                      .toList(),
                  onChanged: (value) {
                    setState(() => _selectedRemarks = value ?? _selectedRemarks);
                  },
                ),
                const SizedBox(height: 32),
                const Divider(),
                const SizedBox(height: 24),
              ],

              // Academic Period Section — auto-assigned to the active period.
              const Text(
                'Academic Period',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.cardBackground,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.divider),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.event_available_outlined,
                        size: 20, color: AppColors.primary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Active Period',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '$_selectedSemester, A.Y. $_selectedAcademicYear',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              if (widget.corOnly) ...[
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.cardBackground,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.divider),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.description_outlined,
                          size: 18,
                          color: isCorRequired
                              ? AppColors.textPrimary
                              : AppColors.textSecondary,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Certificate of Registration',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: isCorRequired
                                ? AppColors.textPrimary
                                : AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      isCorRequired
                          ? 'Upload once per semester (PDF/JPG/PNG).'
                          : 'COR upload is optional for your school.',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 10),
                    if (corSubmission != null)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.success.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: AppColors.success.withValues(alpha: 0.25),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.check_circle_outline_rounded,
                              size: 16,
                              color: AppColors.success,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                corSubmission.fileName,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: AppColors.success,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: 10),
                    if (corSubmission == null)
                      CustomButton(
                        text: 'Upload COR',
                        onPressed: _handleCorUpload,
                        icon: Icons.upload_file_rounded,
                        width: double.infinity,
                      )
                    else
                      Column(
                        children: [
                          CustomButton(
                            text: 'Replace COR',
                            onPressed: _handleCorUpload,
                            icon: Icons.upload_file_rounded,
                            width: double.infinity,
                          ),
                          const SizedBox(height: 8),
                          CustomButton(
                            text: 'Remove',
                            onPressed: () {
                              ref
                                  .read(corSubmissionsProvider.notifier)
                                  .removeCor(
                                    academicYear: _selectedAcademicYear,
                                    semester: _selectedSemester,
                                  );
                            },
                            isOutlined: true,
                            width: double.infinity,
                          ),
                        ],
                      ),
                  ],
                ),
              ),
              ],

              const SizedBox(height: 40),

              if (!widget.corOnly) ...[
                // Submit Button
                GradientButton(
                  text: 'Add Subject',
                  onPressed: _handleSubmit,
                  isLoading: _isLoading,
                  width: double.infinity,
                ),
                const SizedBox(height: 16),
              ],
              CustomButton(
                text: widget.corOnly ? 'Submit' : 'Cancel',
                onPressed: () => context.pop(),
                isOutlined: true,
                width: double.infinity,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
