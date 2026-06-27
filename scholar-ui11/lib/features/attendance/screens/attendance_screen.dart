import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/core/utils/formatters.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/attendance/providers/attendance_provider.dart';
import 'package:iskonnectttt/shared/widgets/loading_widget.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';

class AttendanceScreen extends ConsumerWidget {
  const AttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final student = ref.watch(currentStudentProvider);
    final attendanceList = ref.watch(attendanceProvider);
    final summary = ref.watch(attendanceSummaryProvider);

    if (student == null) {
      return const Center(child: CircularProgressIndicator());
    }

    // St. Augustine Seminary exemption
    if (student.isStAugustine) {
      return Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Column(
            children: [
              _ModernHeader(
                title: 'Attendance',
                subtitle: 'Track your participation',
                onBack: () => context.go('/dashboard'),
              ),
              Expanded(
                child: EmptyStateWidget(
                  icon: Icons.event_busy_rounded,
                  title: 'Not Applicable',
                  message:
                      'As a St. Augustine Seminary student, you are exempt from attendance requirements for CED activities.',
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // Modern Header
            SliverToBoxAdapter(
              child: _ModernHeader(
                title: 'Attendance',
                subtitle: 'Track your participation',
                onBack: () => context.go('/dashboard'),
              ).animate().fadeIn(duration: 400.ms).slideX(begin: -0.1),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 8)),

            // Summary Card - Compact Design
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppColors.teal, AppColors.tealLight],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.primary, width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.teal.withValues(alpha: 0.3),
                        blurRadius: 16,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      // Progress Circle - Compact
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: CircularPercentIndicator(
                          radius: 44,
                          lineWidth: 8,
                          percent: summary.attendanceRate,
                          center: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                '${summary.attendancePercentage.round()}%',
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                'Rate',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: Colors.white.withValues(alpha: 0.7),
                                ),
                              ),
                            ],
                          ),
                          progressColor: Colors.white,
                          backgroundColor: Colors.white.withValues(alpha: 0.2),
                          circularStrokeCap: CircularStrokeCap.round,
                        ),
                      ),
                      const SizedBox(width: 16),
                      // Stats Column
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _CompactAttendanceRow(
                              label: 'Total',
                              value: '${summary.totalActivities}',
                              color: Colors.white,
                            ),
                            const SizedBox(height: 8),
                            _CompactAttendanceRow(
                              label: 'Present',
                              value: '${summary.present}',
                              color: const Color(0xFF4ADE80),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: _CompactAttendanceRow(
                                    label: 'Absent',
                                    value: '${summary.absent}',
                                    color: const Color(0xFFF87171),
                                  ),
                                ),
                                Expanded(
                                  child: _CompactAttendanceRow(
                                    label: 'Excused',
                                    value: '${summary.excused}',
                                    color: const Color(0xFFFBBF24),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 20)),

            // Attendance List Header
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Activity History',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.3,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text(
                        '${attendanceList.length}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ],
                ).animate().fadeIn(delay: 300.ms),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 12)),

            // Attendance List
            if (attendanceList.isEmpty)
              SliverToBoxAdapter(
                child: EmptyStateWidget(
                  icon: Icons.event_available,
                  title: 'No Activities Yet',
                  message: 'Your attendance records will appear here.',
                ).animate().fadeIn(delay: 400.ms).scale(begin: const Offset(0.95, 0.95)),
              )
            else
              SliverList(
                delegate: SliverChildBuilderDelegate((context, index) {
                  final attendance = attendanceList[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 4,
                    ),
                    child: _AttendanceCard(
                      activityName: attendance.activityName,
                      date: attendance.date,
                      status: attendance.status,
                      timeIn: attendance.timeIn,
                      timeOut: attendance.timeOut,
                      remarks: attendance.remarks,
                    ).animate()
                        .fadeIn(delay: Duration(milliseconds: 350 + (index * 50)))
                        .slideY(begin: 0.05, delay: Duration(milliseconds: 350 + (index * 50))),
                  );
                }, childCount: attendanceList.length),
              ),

            // Bottom Padding
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }
}

/// Modern Header Widget
class _ModernHeader extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback onBack;

  const _ModernHeader({
    required this.title,
    required this.subtitle,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          Container(
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
                onTap: onBack,
                child: const Center(
                  child: Icon(
                    Icons.arrow_back_ios_new_rounded,
                    size: 16,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
                Text(
                  subtitle,
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
    );
  }
}

/// Compact Attendance Row
class _CompactAttendanceRow extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _CompactAttendanceRow({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.white.withValues(alpha: 0.8),
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
      ],
    );
  }
}

class _AttendanceCard extends StatelessWidget {
  final String activityName;
  final DateTime date;
  final String status;
  final String? timeIn;
  final String? timeOut;
  final String? remarks;

  const _AttendanceCard({
    required this.activityName,
    required this.date,
    required this.status,
    this.timeIn,
    this.timeOut,
    this.remarks,
  });

  Color _getStatusColor() {
    switch (status.toLowerCase()) {
      case 'present':
        return AppColors.success;
      case 'absent':
        return AppColors.error;
      case 'excused':
        return AppColors.warning;
      default:
        return AppColors.textSecondary;
    }
  }

  IconData _getStatusIcon() {
    switch (status.toLowerCase()) {
      case 'present':
        return Icons.check_circle;
      case 'absent':
        return Icons.cancel;
      case 'excused':
        return Icons.info;
      default:
        return Icons.help;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
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
                      activityName,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      Formatters.formatFullDate(date),
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: _getStatusColor().withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: _getStatusColor(),
                  ),
                ),
              ),
            ],
          ),
          if (status.toLowerCase() == 'present' &&
              (timeIn != null || timeOut != null)) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                if (timeIn != null) ...[
                  const Icon(Icons.login, size: 12, color: AppColors.success),
                  const SizedBox(width: 4),
                  Text(
                    'In: $timeIn',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
                if (timeIn != null && timeOut != null)
                  const SizedBox(width: 16),
                if (timeOut != null) ...[
                  const Icon(Icons.logout, size: 12, color: AppColors.error),
                  const SizedBox(width: 4),
                  Text(
                    'Out: $timeOut',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}
