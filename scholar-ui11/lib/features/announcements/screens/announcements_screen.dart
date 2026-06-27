import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/core/utils/formatters.dart';
import 'package:iskonnectttt/features/announcements/providers/announcements_provider.dart';
import 'package:iskonnectttt/shared/widgets/loading_widget.dart';

class AnnouncementsScreen extends ConsumerWidget {
  const AnnouncementsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Use filtered announcements based on user type
    final announcements = ref.watch(filteredAnnouncementsProvider);
    final unreadCount = ref.watch(unreadAnnouncementsCountProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // Modern Header - Compact
            SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Back button row
                    Row(
                      children: [
                        _ModernBackButton(
                          onTap: () => context.go('/dashboard'),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Announcements',
                                style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                  letterSpacing: -0.5,
                                ),
                              ),
                              if (unreadCount > 0)
                                Text(
                                  '$unreadCount unread',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.coral,
                                  ),
                                )
                              else
                                Text(
                                  'All caught up! ✨',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (unreadCount > 0)
                          Container(
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: IconButton(
                              onPressed: () {
                                ref
                                    .read(announcementsProvider.notifier)
                                    .markAllAsRead();
                              },
                              icon: const Icon(
                                Icons.done_all_rounded,
                                size: 20,
                              ),
                              color: AppColors.primary,
                              tooltip: 'Mark all read',
                              padding: const EdgeInsets.all(8),
                              constraints: const BoxConstraints(),
                            ),
                          ),
                      ],
                    ).animate().fadeIn(duration: 400.ms).slideX(begin: -0.1),
                  ],
                ),
              ),
            ),

            // Announcements List
            if (announcements.isEmpty)
              SliverFillRemaining(
                child:
                    EmptyStateWidget(
                          icon: Icons.campaign_outlined,
                          title: 'No Announcements',
                          message: 'There are no announcements at this time.',
                        )
                        .animate()
                        .fadeIn(delay: 300.ms)
                        .scale(begin: const Offset(0.95, 0.95)),
              )
            else
              SliverList(
                delegate: SliverChildBuilderDelegate((context, index) {
                  final announcement = announcements[index];
                  return _AnnouncementCard(
                        id: announcement.id,
                        title: announcement.title,
                        content: announcement.content,
                        date: announcement.date,
                        isImportant: announcement.isImportant,
                        isRead: announcement.isRead,
                        hasAttachments: announcement.attachments.isNotEmpty,
                        onTap: () {
                          ref
                              .read(announcementsProvider.notifier)
                              .markAsRead(announcement.id);
                          context.go('/announcements/${announcement.id}');
                        },
                      )
                      .animate()
                      .fadeIn(delay: Duration(milliseconds: 200 + (index * 50)))
                      .slideY(
                        begin: 0.05,
                        delay: Duration(milliseconds: 200 + (index * 50)),
                      );
                }, childCount: announcements.length),
              ),

            // Bottom Padding
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }
}

class _AnnouncementCard extends StatelessWidget {
  final String id;
  final String title;
  final String content;
  final DateTime date;
  final bool isImportant;
  final bool isRead;
  final bool hasAttachments;
  final VoidCallback onTap;

  const _AnnouncementCard({
    required this.id,
    required this.title,
    required this.content,
    required this.date,
    required this.isImportant,
    required this.isRead,
    required this.hasAttachments,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: isImportant && !isRead
            ? Border.all(
                color: AppColors.coral.withValues(alpha: 0.3),
                width: 1.5,
              )
            : Border.all(color: AppColors.divider, width: 1),
        boxShadow: [
          BoxShadow(
            color:
                (isImportant && !isRead ? AppColors.coral : AppColors.lavender)
                    .withValues(alpha: isRead ? 0.03 : 0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: isImportant
                              ? [
                                  AppColors.coral,
                                  AppColors.coral.withValues(alpha: 0.8),
                                ]
                              : [AppColors.lavender, AppColors.lavenderLight],
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Center(
                        child: Icon(
                          isImportant
                              ? Icons.priority_high_rounded
                              : Icons.campaign_rounded,
                          color: Colors.white,
                          size: 16,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              if (isImportant)
                                Container(
                                  margin: const EdgeInsets.only(right: 6),
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 5,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.coral,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: const Text(
                                    'URGENT',
                                    style: TextStyle(
                                      fontSize: 7,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                ),
                              Expanded(
                                child: Text(
                                  Formatters.formatRelativeTime(date),
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: AppColors.textTertiary,
                                  ),
                                  textAlign: isImportant
                                      ? TextAlign.left
                                      : TextAlign.right,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            title,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: isRead
                                  ? FontWeight.w500
                                  : FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    if (!isRead)
                      Container(
                        width: 8,
                        height: 8,
                        margin: const EdgeInsets.only(left: 6),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              AppColors.lavender,
                              AppColors.lavenderLight,
                            ],
                          ),
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  content,
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                    height: 1.3,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (hasAttachments) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(
                        Icons.attach_file_rounded,
                        size: 10,
                        color: AppColors.lavender,
                      ),
                      const SizedBox(width: 3),
                      Text(
                        'Attachments',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          color: AppColors.lavender,
                        ),
                      ),
                      const Spacer(),
                      Icon(
                        Icons.arrow_forward_ios_rounded,
                        size: 10,
                        color: AppColors.textTertiary,
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Modern Back Button Widget - Compact
class _ModernBackButton extends StatelessWidget {
  final VoidCallback onTap;

  const _ModernBackButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.divider),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: const Center(
            child: Icon(
              Icons.arrow_back_ios_new_rounded,
              size: 14,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}
