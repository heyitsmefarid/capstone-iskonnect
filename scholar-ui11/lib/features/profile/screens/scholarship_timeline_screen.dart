import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/models/scholarship_timeline_model.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/core/utils/formatters.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/profile/providers/scholarship_timeline_provider.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';

class ScholarshipTimelineScreen extends ConsumerStatefulWidget {
  const ScholarshipTimelineScreen({super.key});

  @override
  ConsumerState<ScholarshipTimelineScreen> createState() =>
      _ScholarshipTimelineScreenState();
}

class _ScholarshipTimelineScreenState
    extends ConsumerState<ScholarshipTimelineScreen> {
  @override
  void initState() {
    super.initState();
    // Initialize scholar status after the first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final student = ref.read(currentStudentProvider);
      if (student != null) {
        ref.read(isScholarForTimelineProvider.notifier).state =
            student.isScholar;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final student = ref.watch(currentStudentProvider);
    final timeline = ref.watch(scholarshipTimelineProvider);
    final disbursements = ref.watch(disbursementsProvider);
    final totalDisbursed = ref.watch(totalDisbursedAmountProvider);
    final progress = ref.watch(timelineProgressProvider);
    final isScholar = student?.isScholar ?? false;

    if (student == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // Header
          SliverToBoxAdapter(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [const Color(0xFF667eea), const Color(0xFF764ba2)],
                ),
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(32),
                  bottomRight: Radius.circular(32),
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: IconButton(
                              icon: const Icon(
                                Icons.arrow_back_ios,
                                color: Colors.white,
                                size: 18,
                              ),
                              onPressed: () => context.pop(),
                              padding: EdgeInsets.zero,
                            ),
                          ),
                          const Expanded(
                            child: Text(
                              'My Journey',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          const SizedBox(width: 40),
                        ],
                      ),
                      const SizedBox(height: 24),
                      // Progress Ring
                      CircularPercentIndicator(
                        radius: 60,
                        lineWidth: 10,
                        percent: progress,
                        center: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              '${(progress * 100).round()}%',
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            const Text(
                              'Complete',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.white70,
                              ),
                            ),
                          ],
                        ),
                        progressColor: Colors.white,
                        backgroundColor: Colors.white.withValues(alpha: 0.3),
                        circularStrokeCap: CircularStrokeCap.round,
                        animation: true,
                        animationDuration: 1200,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        student.fullName,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          isScholar
                              ? (timeline.currentMilestone?.type.displayName ??
                                    'Scholar')
                              : 'Applicant A.Y. 2026',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // Stats Cards
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      icon: Icons.emoji_events,
                      iconColor: const Color(0xFFFFCA28),
                      label: 'Milestones',
                      value:
                          '${timeline.milestones.where((m) => m.isAchieved).length}/${timeline.milestones.length}',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: isScholar
                        ? GestureDetector(
                            onTap: () => _showDisbursementsBottomSheet(
                              context,
                              disbursements,
                            ),
                            child: _StatCard(
                              icon: Icons.account_balance_wallet,
                              iconColor: const Color(0xFF66BB6A),
                              label: 'Total Granted',
                              value:
                                  '₱${Formatters.formatCurrency(totalDisbursed)}',
                            ),
                          )
                        : _StatCard(
                            icon: Icons.pending_actions,
                            iconColor: const Color(0xFF42A5F5),
                            label: 'Application Status',
                            value: _getApplicationStatusText(
                              student.applicationStatus,
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),

          // Applicant notice banner
          if (!isScholar)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF3E0),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFFB74D)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFB74D).withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.lock_outline,
                          color: Color(0xFFE65100),
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Timeline Locked',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFE65100),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Future milestones will unlock once you become a scholar.',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.orange.shade800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // Timeline Section Title
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: isScholar ? 0 : 20,
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.timeline,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    isScholar
                        ? 'Your Scholarship Timeline'
                        : 'Your Application Journey',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Timeline Items
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate((context, index) {
                final milestone = timeline.sortedMilestones[index];
                final isLast = index == timeline.sortedMilestones.length - 1;
                // Determine if milestone is locked (for applicants, only applicant milestone is unlocked)
                final isLocked =
                    !isScholar &&
                    milestone.type != ScholarshipMilestoneType.applicant;
                return _TimelineItem(
                  milestone: milestone,
                  isLast: isLast,
                  isLocked: isLocked,
                  isScholar: isScholar,
                  onAddMessage: () =>
                      _showAddMessageDialog(context, ref, milestone),
                  onToggleAchieved: () =>
                      _showToggleMilestoneDialog(context, ref, milestone),
                );
              }, childCount: timeline.sortedMilestones.length),
            ),
          ),
        ],
      ),
    );
  }

  String _getApplicationStatusText(String? status) {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'for_exam':
        return 'For Exam';
      case 'for_interview':
        return 'For Interview';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Pending';
    }
  }

  void _showDisbursementsBottomSheet(
    BuildContext context,
    List<ScholarshipDisbursement> disbursements,
  ) {
    final granted = disbursements
        .where((d) => d.status == 'disbursed')
        .toList()
      ..sort((a, b) => b.disbursedDate.compareTo(a.disbursedDate));

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        return Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(20),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Granted Scholarships',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  Text(
                    '${granted.length}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (granted.isEmpty)
                const Text(
                  'No disbursements yet.',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: granted.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final item = granted[index];
                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.cardBackground,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: AppColors.success.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(
                                Icons.payments_rounded,
                                size: 18,
                                color: AppColors.success,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${item.semester} • A.Y. ${item.academicYear}',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Disbursed ${Formatters.formatDateShort(item.disbursedDate)}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              '₱${Formatters.formatCurrency(item.amount)}',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.success,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  void _showAddMessageDialog(
    BuildContext context,
    WidgetRef ref,
    ScholarshipMilestone milestone,
  ) {
    final controller = TextEditingController(text: milestone.message);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(milestone.type.icon, color: milestone.type.color, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                milestone.type.displayName,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Add your thoughts or memories about this milestone:',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Share your experience...',
                filled: true,
                fillColor: AppColors.surfaceVariant,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              ref
                  .read(scholarshipTimelineProvider.notifier)
                  .addMessage(milestone.id, controller.text);
              Navigator.pop(context);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: milestone.type.color,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _showToggleMilestoneDialog(
    BuildContext context,
    WidgetRef ref,
    ScholarshipMilestone milestone,
  ) {
    // Only allow toggling for graduated, boardExamPasser, and employed
    final canToggle =
        milestone.type == ScholarshipMilestoneType.graduated ||
        milestone.type == ScholarshipMilestoneType.boardExamPasser ||
        milestone.type == ScholarshipMilestoneType.employed;

    if (!canToggle) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${milestone.type.displayName} status cannot be changed',
          ),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.textSecondary,
        ),
      );
      return;
    }

    final isCurrentlyAchieved = milestone.isAchieved;
    final messageController = TextEditingController(
      text: milestone.message ?? '',
    );

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        decoration: const BoxDecoration(
          color: AppColors.cardBackground,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: milestone.type.color.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(
                      milestone.type.icon,
                      color: milestone.type.color,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Update ${milestone.type.displayName} Status',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          isCurrentlyAchieved
                              ? 'Currently marked as achieved'
                              : 'Mark this milestone when completed',
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Status Toggle Section
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.divider),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Have you achieved this milestone?',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _StatusOption(
                            icon: Icons.check_circle,
                            label: 'Yes, Achieved!',
                            isSelected: isCurrentlyAchieved,
                            color: milestone.type.color,
                            onTap: () {
                              if (!isCurrentlyAchieved) {
                                ref
                                    .read(scholarshipTimelineProvider.notifier)
                                    .achieveMilestone(
                                      milestone.id,
                                      message: messageController.text.isNotEmpty
                                          ? messageController.text
                                          : null,
                                    );
                                Navigator.pop(context);
                                _showCongratulationsDialog(context, milestone);
                              }
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _StatusOption(
                            icon: Icons.schedule,
                            label: 'Not Yet',
                            isSelected: !isCurrentlyAchieved,
                            color: AppColors.textTertiary,
                            onTap: () {
                              if (isCurrentlyAchieved) {
                                ref
                                    .read(scholarshipTimelineProvider.notifier)
                                    .unachieveMilestone(milestone.id);
                                Navigator.pop(context);
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Message Input (only show if marking as achieved)
              if (!isCurrentlyAchieved) ...[
                const Text(
                  'Share your achievement story (optional)',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: messageController,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText:
                        'e.g., "Finally graduated after 4 years of hard work! 🎓"',
                    hintStyle: TextStyle(
                      color: AppColors.textTertiary,
                      fontSize: 13,
                    ),
                    filled: true,
                    fillColor: AppColors.background,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: AppColors.divider),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: AppColors.divider),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: milestone.type.color,
                        width: 2,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Mark as Achieved Button
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: () {
                      ref
                          .read(scholarshipTimelineProvider.notifier)
                          .achieveMilestone(
                            milestone.id,
                            message: messageController.text.isNotEmpty
                                ? messageController.text
                                : null,
                          );
                      Navigator.pop(context);
                      _showCongratulationsDialog(context, milestone);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: milestone.type.color,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.celebration, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          'Mark as ${milestone.type.displayName}',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  void _showCongratulationsDialog(
    BuildContext context,
    ScholarshipMilestone milestone,
  ) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        contentPadding: const EdgeInsets.all(24),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: milestone.type.color.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.celebration_rounded,
                color: milestone.type.color,
                size: 40,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              '🎉 Congratulations! 🎉',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'You have marked yourself as ${milestone.type.displayName}!',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 8),
            Text(
              _getCongratulationsMessage(milestone.type),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: milestone.type.color,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Thank You!',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getCongratulationsMessage(ScholarshipMilestoneType type) {
    switch (type) {
      case ScholarshipMilestoneType.graduated:
        return 'Your hard work and dedication have paid off. We\'re proud of your achievement!';
      case ScholarshipMilestoneType.boardExamPasser:
        return 'Passing the board exam is a huge accomplishment. You\'re now a licensed professional!';
      case ScholarshipMilestoneType.employed:
        return 'Congratulations on your new job! This is the beginning of an exciting career journey.';
      default:
        return 'This is a wonderful milestone in your journey!';
    }
  }
}

// Status Option Widget for Toggle
class _StatusOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final Color color;
  final VoidCallback onTap;

  const _StatusOption({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: isSelected
              ? color.withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? color : AppColors.divider,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: isSelected ? color : AppColors.textTertiary,
              size: 28,
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? color : AppColors.textTertiary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;

  const _StatCard({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.cardShadow.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _TimelineItem extends StatelessWidget {
  final ScholarshipMilestone milestone;
  final bool isLast;
  final bool isLocked;
  final bool isScholar;
  final VoidCallback onAddMessage;
  final VoidCallback onToggleAchieved;

  const _TimelineItem({
    required this.milestone,
    required this.isLast,
    this.isLocked = false,
    this.isScholar = true,
    required this.onAddMessage,
    required this.onToggleAchieved,
  });

  // Check if this milestone can be edited by user (only for scholars)
  bool get _canToggle =>
      isScholar &&
      !isLocked &&
      (milestone.type == ScholarshipMilestoneType.graduated ||
          milestone.type == ScholarshipMilestoneType.boardExamPasser ||
          milestone.type == ScholarshipMilestoneType.employed);

  @override
  Widget build(BuildContext context) {
    final isAchieved = milestone.isAchieved;
    final color = isLocked
        ? AppColors.textTertiary.withValues(alpha: 0.5)
        : (isAchieved ? milestone.type.color : AppColors.textTertiary);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Timeline line and dot
          SizedBox(
            width: 60,
            child: Column(
              children: [
                // Dot with icon (show lock for locked milestones)
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: isLocked
                        ? Colors.grey.shade300
                        : (isAchieved ? color : color.withValues(alpha: 0.2)),
                    shape: BoxShape.circle,
                    border: (isAchieved || isLocked)
                        ? null
                        : Border.all(
                            color: color.withValues(alpha: 0.5),
                            width: 2,
                            strokeAlign: BorderSide.strokeAlignOutside,
                          ),
                    boxShadow: (isAchieved && !isLocked)
                        ? [
                            BoxShadow(
                              color: color.withValues(alpha: 0.4),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ]
                        : null,
                  ),
                  child: Icon(
                    isLocked ? Icons.lock_outline : milestone.type.icon,
                    color: isLocked
                        ? Colors.grey.shade500
                        : (isAchieved ? Colors.white : color),
                    size: 22,
                  ),
                ),
                // Connecting line
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 3,
                      margin: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: isLocked
                              ? [Colors.grey.shade300, Colors.grey.shade200]
                              : (isAchieved
                                    ? [color, color.withValues(alpha: 0.3)]
                                    : [
                                        AppColors.divider,
                                        AppColors.divider.withValues(
                                          alpha: 0.5,
                                        ),
                                      ]),
                        ),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // Content
          Expanded(
            child: Container(
              margin: EdgeInsets.only(bottom: isLast ? 0 : 20),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isLocked
                    ? Colors.grey.shade100
                    : (isAchieved
                          ? AppColors.cardBackground
                          : AppColors.surfaceVariant.withValues(alpha: 0.5)),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isLocked
                      ? Colors.grey.shade300
                      : (isAchieved
                            ? color.withValues(alpha: 0.3)
                            : AppColors.divider),
                ),
                boxShadow: (isAchieved && !isLocked)
                    ? [
                        BoxShadow(
                          color: AppColors.cardShadow.withValues(alpha: 0.08),
                          blurRadius: 16,
                          offset: const Offset(0, 4),
                        ),
                      ]
                    : null,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              milestone.type.displayName,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: isLocked
                                    ? Colors.grey.shade500
                                    : (isAchieved
                                          ? AppColors.textPrimary
                                          : AppColors.textTertiary),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              isLocked
                                  ? 'Locked - Become a scholar first'
                                  : Formatters.formatDate(milestone.date),
                              style: TextStyle(
                                fontSize: 12,
                                color: isLocked
                                    ? Colors.grey.shade400
                                    : (isAchieved
                                          ? color
                                          : AppColors.textTertiary),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (isLocked)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.lock,
                                color: Colors.grey.shade500,
                                size: 14,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Locked',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.grey.shade500,
                                ),
                              ),
                            ],
                          ),
                        )
                      else if (isAchieved)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.check_circle, color: color, size: 14),
                              const SizedBox(width: 4),
                              Text(
                                'Achieved',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: color,
                                ),
                              ),
                            ],
                          ),
                        )
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceVariant,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.schedule,
                                color: AppColors.textTertiary,
                                size: 14,
                              ),
                              SizedBox(width: 4),
                              Text(
                                'Upcoming',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                  color: AppColors.textTertiary,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    isLocked
                        ? 'This milestone will unlock once you become an official CED scholar.'
                        : milestone.type.description,
                    style: TextStyle(
                      fontSize: 13,
                      color: isLocked
                          ? Colors.grey.shade400
                          : (isAchieved
                                ? AppColors.textSecondary
                                : AppColors.textTertiary),
                      height: 1.4,
                    ),
                  ),
                  if (!isLocked &&
                      milestone.message != null &&
                      milestone.message!.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: color.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.format_quote, color: color, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              milestone.message!,
                              style: TextStyle(
                                fontSize: 13,
                                fontStyle: FontStyle.italic,
                                color: AppColors.textPrimary,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (!isLocked && isAchieved) ...[
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        GestureDetector(
                          onTap: onAddMessage,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceVariant,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  milestone.message != null
                                      ? Icons.edit
                                      : Icons.add,
                                  color: AppColors.textSecondary,
                                  size: 16,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  milestone.message != null ? 'Edit' : 'Add',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textSecondary,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        if (_canToggle)
                          GestureDetector(
                            onTap: onToggleAchieved,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.settings, color: color, size: 16),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Update',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: color,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                  // Show "Mark as achieved" button for unachieved toggleable milestones (only for scholars)
                  if (!isLocked && !isAchieved && _canToggle) ...[
                    const SizedBox(height: 12),
                    GestureDetector(
                      onTap: onToggleAchieved,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              milestone.type.color,
                              milestone.type.color.withValues(alpha: 0.8),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: [
                            BoxShadow(
                              color: milestone.type.color.withValues(
                                alpha: 0.3,
                              ),
                              blurRadius: 8,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.check_circle_outline,
                              color: Colors.white,
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                'Mark as ${milestone.type.displayName}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
