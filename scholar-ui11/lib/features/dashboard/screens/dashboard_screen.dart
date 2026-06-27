import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';
import 'package:iskonnectttt/core/constants/app_constants.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/core/utils/formatters.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/attendance/providers/attendance_provider.dart';
import 'package:iskonnectttt/features/grades/providers/grades_provider.dart';
import 'package:iskonnectttt/features/announcements/providers/announcements_provider.dart';
import 'package:iskonnectttt/features/requirements/providers/requirements_provider.dart';
import 'package:iskonnectttt/features/profile/providers/scholarship_timeline_provider.dart';
import 'package:iskonnectttt/shared/widgets/dialog_helper.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final student = ref.watch(currentStudentProvider);
    final attendanceSummary = ref.watch(attendanceSummaryProvider);
    // Requirements verified/total are read from the scholar's Firestore record
    // (the same data the admin reviews), not local placeholders.
    final requirementsSummary =
        ref.watch(firestoreRequirementsSummaryProvider).asData?.value;
    // Count requirements the scholar has turned in (submitted or already
    // verified) so the card reflects real submission progress.
    final requirementsDone = (requirementsSummary?.verified ?? 0) +
        (requirementsSummary?.submitted ?? 0);
    final requirementsTotal =
        requirementsSummary?.total ?? kOfficialRequirementKeys.length;
    final announcements = ref.watch(filteredAnnouncementsProvider);
    final unreadCount = ref.watch(unreadAnnouncementsCountProvider);
    final totalDisbursed = ref.watch(totalDisbursedAmountProvider);
    // Total subjects on record (admin-encoded grades reflect here immediately).
    final totalSubjects = ref.watch(gradesProvider).length;
    final timelineProgress = ref.watch(timelineProgressProvider);

    if (student == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // Compact Animated Header
          SliverToBoxAdapter(
            child: SafeArea(
              bottom: false,
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.primaryDark, AppColors.primary, AppColors.primaryLight],
                  ),
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.25),
                      blurRadius: 20,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Avatar with animated ring
                    GestureDetector(
                          onTap: () => context.go('/profile'),
                          child: Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              gradient: student.profilePicture == null
                                  ? LinearGradient(
                                      colors: [
                                        AppColors.secondary,
                                        AppColors.mint,
                                      ],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    )
                                  : null,
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.secondary.withValues(
                                    alpha: 0.3,
                                  ),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: student.profilePicture != null
                                  ? Image.memory(
                                      base64Decode(student.profilePicture!),
                                      fit: BoxFit.cover,
                                      width: 42,
                                      height: 42,
                                    )
                                  : Center(
                                      child: Text(
                                        student.firstName[0].toUpperCase(),
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w800,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                    ),
                            ),
                          ),
                        )
                        .animate(onPlay: (c) => c.repeat(reverse: true))
                        .shimmer(
                          duration: 2000.ms,
                          color: Colors.white.withValues(alpha: 0.2),
                        ),
                    const SizedBox(width: 12),
                    // Greeting
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Hello! 👋',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: Colors.white.withValues(alpha: 0.8),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            student.firstName,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              letterSpacing: -0.3,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    // Notification Badge
                    Stack(
                      children: [
                        Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: IconButton(
                            padding: EdgeInsets.zero,
                            icon: const Icon(
                              Icons.notifications_outlined,
                              color: Colors.white,
                              size: 20,
                            ),
                            onPressed: () => context.go('/announcements'),
                          ),
                        ),
                        if (unreadCount > 0)
                          Positioned(
                            right: 2,
                            top: 2,
                            child:
                                Container(
                                      width: 16,
                                      height: 16,
                                      decoration: BoxDecoration(
                                        color: AppColors.coral,
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: AppColors.primary,
                                          width: 1.5,
                                        ),
                                      ),
                                      child: Center(
                                        child: Text(
                                          unreadCount > 9
                                              ? '9+'
                                              : '$unreadCount',
                                          style: const TextStyle(
                                            fontSize: 8,
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    )
                                    .animate(onPlay: (c) => c.repeat())
                                    .scale(
                                      begin: const Offset(1, 1),
                                      end: const Offset(1.1, 1.1),
                                      duration: 800.ms,
                                    )
                                    .then()
                                    .scale(
                                      begin: const Offset(1.1, 1.1),
                                      end: const Offset(1, 1),
                                      duration: 800.ms,
                                    ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Compact Amount Card
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: GestureDetector(
                onTap: () => context.push('/scholarship-timeline'),
                child: Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF1B7A6E), Color(0xFF2D9596), Color(0xFF4ECDC4)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF2D9596).withValues(alpha: 0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Stack(
                    children: [
                      // Decorative circle
                      Positioned(
                        right: -20,
                        top: -20,
                        child: Container(
                          width: 90,
                          height: 90,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white.withValues(alpha: 0.07),
                          ),
                        ),
                      ),
                      Row(
                        children: [
                          Container(
                            width: 50,
                            height: 50,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Icon(
                              Icons.account_balance_wallet_rounded,
                              color: Colors.white,
                              size: 26,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Total Scholarship Received',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white.withValues(alpha: 0.85),
                                    letterSpacing: 0.2,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  // Prefer real disbursement records; otherwise
                                  // fall back to the admin-granted total
                                  // (completed semesters × per-sem grant).
                                  '₱${Formatters.formatCurrency(totalDisbursed > 0 ? totalDisbursed : student.semestersCompleted * student.amountGranted)}',
                                  style: const TextStyle(
                                    fontSize: 24,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                    letterSpacing: -0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 5,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.22),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  student.scholarshipStatus,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '${student.semestersCompleted}/${AppConstants.maxSemesters} sem',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white.withValues(alpha: 0.75),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 6),
                          Icon(
                            Icons.chevron_right_rounded,
                            color: Colors.white.withValues(alpha: 0.6),
                            size: 22,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 18)),

          // Stats Grid - Compact 2x2
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  const Text(
                    'Overview',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: AppColors.success,
                          shape: BoxShape.circle,
                        ),
                      )
                      .animate(onPlay: (c) => c.repeat())
                      .scale(
                        begin: const Offset(1, 1),
                        end: const Offset(1.3, 1.3),
                        duration: 800.ms,
                      )
                      .then()
                      .scale(
                        begin: const Offset(1.3, 1.3),
                        end: const Offset(1, 1),
                        duration: 800.ms,
                      ),
                ],
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 12)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              // IntrinsicHeight bounds the row to its tallest card so
              // CrossAxisAlignment.stretch can equalize heights inside the
              // scroll view (a bare stretched Row here would be unbounded).
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: _CompactStatCard(
                        icon: Icons.menu_book_rounded,
                        value: '$totalSubjects',
                        label: 'Subjects',
                        caption: 'enrolled',
                        color: AppColors.lavender,
                        onTap: () => context.go('/grades'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _CompactStatCard(
                        icon: Icons.timeline_rounded,
                        value: '${(timelineProgress * 100).toInt()}%',
                        label: 'Timeline',
                        color: AppColors.coral,
                        progress: timelineProgress.clamp(0.0, 1.0),
                        onTap: () => context.push('/scholarship-timeline'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 12)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: IntrinsicHeight(
                child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: _CompactStatCard(
                      icon: Icons.calendar_today_rounded,
                      value: student.isStAugustine
                          ? '—'
                          : '${attendanceSummary.present}/${attendanceSummary.totalActivities}',
                      label: student.isStAugustine ? 'Exempt' : 'Attendance',
                      caption: student.isStAugustine ? 'no attendance' : 'present',
                      color: student.isStAugustine
                          ? AppColors.textTertiary
                          : AppColors.teal,
                      progress: student.isStAugustine ||
                              attendanceSummary.totalActivities == 0
                          ? null
                          : (attendanceSummary.present /
                                  attendanceSummary.totalActivities)
                              .clamp(0.0, 1.0),
                      onTap: student.isStAugustine
                          ? null
                          : () => context.go('/attendance'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _CompactStatCard(
                      icon: Icons.folder_copy_rounded,
                      value: '$requirementsDone/$requirementsTotal',
                      label: 'Requirements',
                      caption: 'submitted',
                      color: AppColors.mustard,
                      progress: requirementsTotal == 0
                          ? null
                          : (requirementsDone / requirementsTotal)
                              .clamp(0.0, 1.0),
                      onTap: () => context.go('/requirements'),
                    ),
                  ),
                ],
                ),
              ),
            ),
          ),

          // Recent Announcements
          const SliverToBoxAdapter(child: SizedBox(height: 20)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Announcements',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ),
                  GestureDetector(
                    onTap: () => context.go('/announcements'),
                    child: Text(
                      'See all →',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 12)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: announcements.take(3).map((announcement) {
                  return _CompactAnnouncementCard(
                        title: announcement.title,
                        date: Formatters.formatRelativeTime(announcement.date),
                        isImportant: announcement.isImportant,
                        isUnread: !announcement.isRead,
                        onTap: () {
                          ref
                              .read(announcementsProvider.notifier)
                              .markAsRead(announcement.id);
                          context.go('/announcements/${announcement.id}');
                        },
                      );
                }).toList(),
              ),
            ),
          ),

          // Progress Reminder Card
          const SliverToBoxAdapter(child: SizedBox(height: 16)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: GestureDetector(
                onTap: () => context.go('/assessment'),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.secondary.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.2),
                      width: 1.5,
                    ),
                  ),
                  child: Row(
                    children: [
                      CircularPercentIndicator(
                        radius: 24,
                        lineWidth: 4,
                        percent:
                            student.semestersCompleted /
                            AppConstants.maxSemesters,
                        center: Text(
                          '${((student.semestersCompleted / AppConstants.maxSemesters) * 100).round()}%',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                        progressColor: AppColors.primary,
                        backgroundColor: AppColors.border,
                        circularStrokeCap: CircularStrokeCap.round,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Scholarship Progress',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${student.semestersCompleted} of ${AppConstants.maxSemesters} semesters completed',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
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
          ),

          // Logout Button
          const SliverToBoxAdapter(child: SizedBox(height: 20)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextButton.icon(
                onPressed: () {
                  DialogHelper.showConfirmDialog(
                    context: context,
                    title: 'Logout',
                    message: 'Are you sure you want to logout?',
                    confirmText: 'Logout',
                    onConfirm: () {
                      ref.read(authStateProvider.notifier).logout();
                      context.go('/login');
                    },
                  );
                },
                icon: const Icon(
                  Icons.logout_rounded,
                  color: AppColors.error,
                  size: 20,
                ),
                label: const Text(
                  'Sign Out',
                  style: TextStyle(
                    color: AppColors.error,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
    );
  }
}

/// Compact Stat Card
class _CompactStatCard extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  /// 0..1 completion ratio. When provided, a slim accent bar is drawn so the
  /// figure reads as progress at a glance. Omit for plain counts (e.g. Subjects).
  final double? progress;

  /// Short context word shown beside the value (e.g. "submitted").
  final String? caption;

  const _CompactStatCard({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
    this.onTap,
    this.progress,
    this.caption,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          // Faint accent wash from the corner gives the flat card subtle depth.
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.cardBackground,
              Color.alphaBlend(
                color.withValues(alpha: 0.06),
                AppColors.cardBackground,
              ),
            ],
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withValues(alpha: 0.18), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.10),
              blurRadius: 14,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(icon, color: color, size: 22),
                ),
                if (onTap != null)
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.chevron_right_rounded,
                      color: color.withValues(alpha: 0.6),
                      size: 18,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: color,
                    letterSpacing: -0.5,
                  ),
                ),
                if (caption != null) ...[
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      caption!,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textTertiary,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.textSecondary,
              ),
              overflow: TextOverflow.ellipsis,
            ),
            if (progress != null) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress!,
                  minHeight: 5,
                  backgroundColor: color.withValues(alpha: 0.12),
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Compact Announcement Card
class _CompactAnnouncementCard extends StatelessWidget {
  final String title;
  final String date;
  final bool isImportant;
  final bool isUnread;
  final VoidCallback? onTap;

  const _CompactAnnouncementCard({
    required this.title,
    required this.date,
    required this.isImportant,
    required this.isUnread,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.cardBackground,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isUnread
                ? AppColors.primary.withValues(alpha: 0.2)
                : AppColors.border,
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.cardShadow.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: isImportant
                    ? AppColors.coral.withValues(alpha: 0.12)
                    : AppColors.lavender.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                isImportant
                    ? Icons.priority_high_rounded
                    : Icons.campaign_rounded,
                color: isImportant ? AppColors.coral : AppColors.lavender,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: isUnread ? FontWeight.w700 : FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    date,
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            if (isUnread)
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
            const SizedBox(width: 8),
            Icon(
              Icons.chevron_right_rounded,
              color: AppColors.textTertiary,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
