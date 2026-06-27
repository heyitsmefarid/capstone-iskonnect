import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/models/grade_model.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/grades/providers/grades_provider.dart';
import 'package:open_filex/open_filex.dart';

class GradesScreen extends ConsumerStatefulWidget {
  const GradesScreen({super.key});

  @override
  ConsumerState<GradesScreen> createState() => _GradesScreenState();
}

class _GradesScreenState extends ConsumerState<GradesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  bool _isImageFile(String fileType) {
    final normalized = fileType.toLowerCase();
    return normalized == 'jpg' || normalized == 'jpeg' || normalized == 'png';
  }

  Future<void> _openCorFile(BuildContext context, CorSubmission cor) async {
    if (_isImageFile(cor.fileType) &&
        (cor.filePath != null || cor.fileBytes != null)) {
      await showDialog<void>(
        context: context,
        builder: (dialogContext) {
          return Dialog.fullscreen(
            child: Scaffold(
              backgroundColor: Colors.black,
              appBar: AppBar(
                backgroundColor: Colors.black,
                foregroundColor: Colors.white,
                title: Text(cor.fileName, overflow: TextOverflow.ellipsis),
              ),
              body: Center(
                child: InteractiveViewer(
                  minScale: 0.8,
                  maxScale: 4,
                  child: cor.filePath != null
                      ? Image.file(File(cor.filePath!))
                      : Image.memory(cor.fileBytes!),
                ),
              ),
            ),
          );
        },
      );
      return;
    }

    if (cor.filePath == null) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('File preview is unavailable for this upload.'),
          ),
        );
      }
      return;
    }

    final result = await OpenFilex.open(cor.filePath!);
    if (context.mounted && result.type != ResultType.done) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unable to open file: ${result.message}')),
      );
    }
  }

  void _showCorStorage(
    BuildContext context,
    Map<String, CorSubmission> corSubmissions,
  ) {
    final submissions = corSubmissions.values.toList()
      ..sort((a, b) => b.uploadedAt.compareTo(a.uploadedAt));

    // Capture router before entering the bottom sheet so navigation works after pop.
    final router = GoRouter.of(context);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.folder_open_rounded,
                      color: AppColors.primary,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Submitted COR Storage',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${submissions.length} file${submissions.length == 1 ? '' : 's'} — tap edit to replace',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 14),
                if (submissions.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.divider),
                    ),
                    child: const Text(
                      'No submitted COR yet.',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  )
                else
                  Flexible(
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: submissions.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (_, index) {
                        final cor = submissions[index];
                        return Material(
                          color: AppColors.cardBackground,
                          borderRadius: BorderRadius.circular(10),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(10),
                            onTap: () => _openCorFile(sheetCtx, cor),
                            child: Container(
                              padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.divider),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          cor.periodLabel,
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          cor.fileName,
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: AppColors.textSecondary,
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(
                                      Icons.edit_outlined,
                                      size: 18,
                                      color: AppColors.primary,
                                    ),
                                    tooltip: 'Replace COR',
                                    onPressed: () {
                                      Navigator.of(sheetCtx).pop();
                                      router.push('/grades/add-cor');
                                    },
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final student = ref.watch(currentStudentProvider);
    final gradeSummary = ref.watch(gradeSummaryProvider);
    final availablePeriods = ref.watch(availablePeriodsProvider);
    final selectedPeriod = ref.watch(selectedPeriodProvider);
    final corSubmissions = ref.watch(corSubmissionsProvider);
    final selectedPeriodKey = selectedPeriod == null
        ? null
        : buildAcademicPeriodKey(
            academicYear: selectedPeriod.academicYear,
            semester: selectedPeriod.semester,
          );

    final selectedCor = selectedPeriod == null
        ? null
        : corSubmissions[selectedPeriodKey];

    if (student == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.lavender, AppColors.lavenderLight],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primary, width: 2),
              boxShadow: [
                BoxShadow(
                  color: AppColors.lavender.withValues(alpha: 0.4),
                  blurRadius: 12,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: FloatingActionButton.extended(
              heroTag: 'add-subject-fab',
              onPressed: () => context.push('/grades/add'),
              icon: const Icon(Icons.add_rounded, size: 22),
              label: const Text(
                'Add Subject',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              backgroundColor: Colors.transparent,
              foregroundColor: Colors.white,
              elevation: 0,
            ),
          ),
          const SizedBox(width: 10),
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.mustard, AppColors.mustardLight],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primary, width: 2),
              boxShadow: [
                BoxShadow(
                  color: AppColors.mustard.withValues(alpha: 0.35),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: FloatingActionButton.extended(
              heroTag: 'add-cor-fab',
              onPressed: () => context.push('/grades/add-cor'),
              icon: const Icon(Icons.upload_file_rounded, size: 20),
              label: const Text(
                'Add COR',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              backgroundColor: Colors.transparent,
              foregroundColor: Colors.white,
              elevation: 0,
            ),
          ),
        ],
      ).animate().fadeIn(delay: 500.ms).scale(),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      body: SafeArea(
        child: Column(
          children: [
            // Modern Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Row(
                children: [
                  _ModernBackButton(onTap: () => context.go('/dashboard')),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Grades',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.5,
                          ),
                        ),
                        Text(
                          'Track your academic progress',
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ).animate().fadeIn(duration: 400.ms).slideX(begin: -0.1),
            ),
            const SizedBox(height: 16),

            // Overall Summary Card - Compact Modern Design
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.lavender, AppColors.lavenderLight],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.primary, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.lavender.withValues(alpha: 0.3),
                      blurRadius: 16,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    // GWA Display
                    Container(
                      width: 70,
                      height: 70,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.3),
                          width: 2,
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            gradeSummary.gwaDisplay,
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            'GWA',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Colors.white.withValues(alpha: 0.8),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    // Stats
                    Expanded(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _CompactSummaryItem(
                            label: 'Subjects',
                            value: '${gradeSummary.totalSubjects}',
                            icon: Icons.menu_book_rounded,
                          ),
                          _CompactSummaryItem(
                            label: 'Units',
                            value: '${gradeSummary.totalUnits}',
                            icon: Icons.stars_rounded,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),
            ),
            const SizedBox(height: 16),

            // Academic Period Filter - Modern Style
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(
                        color: AppColors.cardBackground,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.divider),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.cardShadow.withValues(alpha: 0.05),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<AcademicPeriod?>(
                          value: selectedPeriod,
                          isExpanded: true,
                          hint: const Text('All Semesters'),
                          icon: const Icon(Icons.keyboard_arrow_down_rounded),
                          items: [
                            const DropdownMenuItem<AcademicPeriod?>(
                              value: null,
                              child: Text('All Semesters'),
                            ),
                            ...availablePeriods.map((period) {
                              return DropdownMenuItem<AcademicPeriod?>(
                                value: period,
                                child: Text(
                                  period.displayName,
                                  style: const TextStyle(fontSize: 14),
                                ),
                              );
                            }),
                          ],
                          onChanged: (value) {
                            ref.read(selectedPeriodProvider.notifier).state =
                                value;
                          },
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.cardBackground,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.divider),
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.filter_list_off_rounded),
                      onPressed: () {
                        ref.read(selectedPeriodProvider.notifier).state = null;
                      },
                      tooltip: 'Clear Filter',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            if (!student.isStAugustine && selectedPeriod != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: selectedCor == null
                        ? AppColors.warningLight
                        : AppColors.success.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: selectedCor == null
                          ? AppColors.warning.withValues(alpha: 0.35)
                          : AppColors.success.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        selectedCor == null
                            ? Icons.warning_amber_rounded
                            : Icons.check_circle_outline_rounded,
                        color: selectedCor == null
                            ? AppColors.warning
                            : AppColors.success,
                        size: 18,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              selectedCor == null
                                  ? 'COR not submitted for this semester'
                                  : 'COR submitted for this semester',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: selectedCor == null
                                    ? AppColors.warning
                                    : AppColors.success,
                              ),
                            ),
                            if (selectedCor != null)
                              GestureDetector(
                                onTap: () => _openCorFile(context, selectedCor),
                                child: Text(
                                  selectedCor.fileName,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppColors.textSecondary,
                                    decoration: TextDecoration.underline,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          if (selectedCor == null) {
                            context.push('/grades/add');
                          } else {
                            _openCorFile(context, selectedCor);
                          }
                        },
                        child: Text(selectedCor == null ? 'Upload' : 'Open'),
                      ),
                    ],
                  ),
                ),
              ),

            if (!student.isStAugustine && selectedPeriod != null)
              const SizedBox(height: 8),

            if (!student.isStAugustine)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () => _showCorStorage(context, corSubmissions),
                    icon: const Icon(Icons.folder_open_rounded, size: 18),
                    label: Text('View COR Storage (${corSubmissions.length})'),
                  ),
                ),
              ),

            if (!student.isStAugustine) const SizedBox(height: 4),

            // St Augustine Notice
            if (student.isStAugustine)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.infoLight,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppColors.info.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.info_outline,
                        color: AppColors.info,
                        size: 18,
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Text(
                          'St. Augustine Seminary students are exempt from COR submission.',
                          style: TextStyle(fontSize: 11, color: AppColors.info),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            // Tabs
            Container(
              margin: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              decoration: BoxDecoration(
                color: AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(10),
              ),
              child: TabBar(
                controller: _tabController,
                indicator: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(8),
                ),
                indicatorSize: TabBarIndicatorSize.tab,
                dividerColor: Colors.transparent,
                labelColor: Colors.white,
                unselectedLabelColor: AppColors.textSecondary,
                labelStyle: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
                padding: const EdgeInsets.all(3),
                tabs: const [
                  Tab(text: 'Current'),
                  Tab(text: 'History'),
                ],
              ),
            ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.1),
            const SizedBox(height: 8),

            // Tab Content
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [_CurrentSemesterTab(), _PastGradesTab()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Modern back button widget
class _ModernBackButton extends StatelessWidget {
  final VoidCallback onTap;

  const _ModernBackButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
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
              size: 18,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}

/// Compact summary item for the new design
class _CompactSummaryItem extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;

  const _CompactSummaryItem({
    required this.label,
    required this.value,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: Colors.white.withValues(alpha: 0.9), size: 18),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: Colors.white.withValues(alpha: 0.7),
          ),
        ),
      ],
    );
  }
}

class _CurrentSemesterTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final allGrades = ref.watch(gradesProvider);
    final activeAsync = ref.watch(activeAcademicPeriodProvider);
    // Show grades that belong to the active period (regardless of graded status).
    // Falls back to ungraded subjects if the active period hasn't loaded yet.
    final currentGrades = activeAsync.maybeWhen(
      data: (active) => allGrades
          .where((g) =>
              g.academicYear == active.schoolYear &&
              g.semester == active.semester)
          .toList(),
      orElse: () => allGrades.where((g) => !g.isGraded).toList(),
    );

    if (currentGrades.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child:
              Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.book_outlined,
                        size: 56,
                        color: AppColors.textTertiary,
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'No Current Subjects',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Add your enrolled subjects using the + button.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  )
                  .animate()
                  .fadeIn(duration: 400.ms)
                  .scale(begin: const Offset(0.95, 0.95)),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
      itemCount: currentGrades.length,
      itemBuilder: (context, index) {
        final grade = currentGrades[index];
        return _SubjectCard(grade: grade)
            .animate()
            .fadeIn(delay: Duration(milliseconds: 100 + (index * 50)))
            .slideY(
              begin: 0.1,
              delay: Duration(milliseconds: 100 + (index * 50)),
            );
      },
    );
  }
}

class _PastGradesTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedPeriod = ref.watch(selectedPeriodProvider);
    final allGrades = ref.watch(gradesProvider);
    final activeAsync = ref.watch(activeAcademicPeriodProvider);
    // History = grades NOT in the active period.
    // Falls back to graded-only if active period hasn't loaded yet.
    List<GradeModel> pastGrades = activeAsync.maybeWhen(
      data: (active) => allGrades
          .where((g) =>
              !(g.academicYear == active.schoolYear &&
                g.semester == active.semester))
          .toList(),
      orElse: () => allGrades.where((g) => g.isGraded).toList(),
    );
    if (selectedPeriod != null) {
      pastGrades = pastGrades
          .where((g) =>
              g.academicYear == selectedPeriod.academicYear &&
              g.semester == selectedPeriod.semester)
          .toList();
    }

    if (pastGrades.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child:
              Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.history,
                        size: 56,
                        color: AppColors.textTertiary,
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'No Past Grades',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        selectedPeriod != null
                            ? 'No grades for ${selectedPeriod.displayName}'
                            : 'Your graded subjects will appear here.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  )
                  .animate()
                  .fadeIn(duration: 400.ms)
                  .scale(begin: const Offset(0.95, 0.95)),
        ),
      );
    }

    // Group by semester
    final Map<String, List<GradeModel>> grouped = {};
    for (final grade in pastGrades) {
      final key = '${grade.semester}, A.Y. ${grade.academicYear}';
      grouped.putIfAbsent(key, () => []);
      grouped[key]!.add(grade);
    }

    // Sort keys by academic year descending
    final sortedKeys = grouped.keys.toList()..sort((a, b) => b.compareTo(a));

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
      itemCount: sortedKeys.length,
      itemBuilder: (context, index) {
        final key = sortedKeys[index];
        final grades = grouped[key]!;
        final semSummary = GradeSummary.fromGrades(grades);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Semester Header
            Container(
                  margin: const EdgeInsets.only(top: 6, bottom: 10),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          key,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text(
                          'GWA: ${semSummary.gwaDisplay}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                )
                .animate()
                .fadeIn(delay: Duration(milliseconds: index * 100))
                .slideX(begin: -0.05),
            // Subjects
            ...grades.asMap().entries.map(
              (entry) => _SubjectCard(grade: entry.value, showGrade: true)
                  .animate()
                  .fadeIn(
                    delay: Duration(
                      milliseconds: (index * 100) + (entry.key * 50),
                    ),
                  )
                  .slideY(
                    begin: 0.05,
                    delay: Duration(
                      milliseconds: (index * 100) + (entry.key * 50),
                    ),
                  ),
            ),
            const SizedBox(height: 6),
          ],
        );
      },
    );
  }
}

class _SubjectCard extends ConsumerWidget {
  final GradeModel grade;
  final bool showGrade;

  const _SubjectCard({required this.grade, this.showGrade = false});

  Future<void> _showEditDialog(BuildContext context, WidgetRef ref) async {
    final subjectCodeController = TextEditingController(
      text: grade.subjectCode,
    );
    final subjectNameController = TextEditingController(
      text: grade.subjectName,
    );
    final gradeController = TextEditingController(
      text: grade.grade != null ? grade.grade!.toString() : '',
    );
    int selectedUnits = grade.units;

    await showDialog(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Edit Subject'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: subjectCodeController,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(
                        labelText: 'Subject Code',
                        prefixIcon: Icon(Icons.code),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: subjectNameController,
                      decoration: const InputDecoration(
                        labelText: 'Subject Name',
                        prefixIcon: Icon(Icons.book),
                      ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<int>(
                      initialValue: selectedUnits,
                      decoration: const InputDecoration(
                        labelText: 'Units',
                        prefixIcon: Icon(Icons.stars_rounded),
                      ),
                      items: [1, 2, 3, 4, 5, 6]
                          .map(
                            (unit) => DropdownMenuItem<int>(
                              value: unit,
                              child: Text(
                                '$unit ${unit == 1 ? 'unit' : 'units'}',
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        setDialogState(() {
                          selectedUnits = value ?? selectedUnits;
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: gradeController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Grade (Optional)',
                        prefixIcon: Icon(Icons.grade_outlined),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () {
                    final code = subjectCodeController.text
                        .trim()
                        .toUpperCase();
                    final name = subjectNameController.text.trim();
                    final gradeText = gradeController.text.trim();

                    if (code.isEmpty || name.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Subject code and name are required.'),
                          backgroundColor: AppColors.warning,
                        ),
                      );
                      return;
                    }

                    double? parsedGrade;
                    if (gradeText.isNotEmpty) {
                      parsedGrade = double.tryParse(gradeText);
                      if (parsedGrade == null) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Please enter a valid numeric grade.',
                            ),
                            backgroundColor: AppColors.warning,
                          ),
                        );
                        return;
                      }
                    }

                    ref
                        .read(gradesProvider.notifier)
                        .updateGrade(
                          grade.copyWith(
                            subjectCode: code,
                            subjectName: name,
                            units: selectedUnits,
                            grade: parsedGrade,
                          ),
                        );

                    Navigator.of(dialogContext).pop();
                  },
                  child: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Color _getGradeColor() {
    if (grade.grade == null) return AppColors.textTertiary;
    if (grade.grade! >= 1.0 && grade.grade! <= 1.75) return AppColors.success;
    if (grade.grade! >= 2.0 && grade.grade! <= 2.5) return AppColors.info;
    if (grade.grade! >= 2.75 && grade.grade! <= 3.0) return AppColors.warning;
    return AppColors.error;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.divider),
        boxShadow: [
          BoxShadow(
            color: AppColors.cardShadow.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          // Subject Icon - Smaller
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: showGrade && grade.isGraded
                  ? LinearGradient(
                      colors: [
                        _getGradeColor(),
                        _getGradeColor().withValues(alpha: 0.7),
                      ],
                    )
                  : AppColors.primaryGradient,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: showGrade && grade.isGraded
                  ? Text(
                      grade.gradeDisplay,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      grade.subjectCode.isNotEmpty ? grade.subjectCode[0] : 'S',
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          // Subject Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        grade.subjectCode,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: showGrade
                              ? _getGradeColor()
                              : AppColors.primary,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 5,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceVariant,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '${grade.units}u',
                        style: const TextStyle(
                          fontSize: 9,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  grade.subjectName,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (!showGrade) ...[
                  const SizedBox(height: 2),
                  Text(
                    '${grade.semester}, A.Y. ${grade.academicYear}',
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.textTertiary,
                    ),
                  ),
                ],
              ],
            ),
          ),
          // Grade Status
          if (showGrade)
            const SizedBox.shrink()
          else
            TextButton.icon(
              onPressed: () => _showEditDialog(context, ref),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                backgroundColor: AppColors.infoLight,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              icon: const Icon(
                Icons.edit_outlined,
                size: 14,
                color: AppColors.info,
              ),
              label: const Text(
                'Edit',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: AppColors.info,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
