import 'package:flutter/material.dart';
import '../models/attendance_record.dart';
import '../utils/date_utils.dart';
import '../theme/app_theme.dart';

/// Card widget for displaying an attendance record
class AttendanceCard extends StatelessWidget {
  final AttendanceRecord record;
  final bool showDate;
  final VoidCallback? onTap;

  const AttendanceCard({
    super.key,
    required this.record,
    this.showDate = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final studentDisplay = (record.studentName?.trim().isNotEmpty ?? false)
        ? record.studentName!.trim()
        : record.studentId;
    final schoolProgramParts = <String>[
      if (record.schoolName != null && record.schoolName!.isNotEmpty)
        record.schoolName!,
      if (record.programName != null && record.programName!.isNotEmpty)
        record.programName!,
    ];

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // Avatar with student icon
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.person_rounded,
                  color: colorScheme.onPrimaryContainer,
                  size: 28,
                ),
              ),
              const SizedBox(width: 16),

              // Student info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      record.eventName,
                      style: textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: colorScheme.onSurface,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      studentDisplay,
                      style: textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: colorScheme.onSurface,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(
                          Icons.school_rounded,
                          size: 14,
                          color: colorScheme.onSurfaceVariant,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            schoolProgramParts.isNotEmpty
                                ? schoolProgramParts.join(' • ')
                                : '—',
                            style: textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Linked ID: ${record.studentId}',
                      style: textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                        fontSize: 10,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),

              // Time and sync status
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    showDate
                        ? DateTimeUtils.formatShortDate(record.scanDateTime)
                        : DateTimeUtils.formatTime(record.scanDateTime),
                    style: textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w500,
                      color: colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 4),
                  _buildSyncStatus(context),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSyncStatus(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    if (record.isSynced) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: colorScheme.success.withAlpha(30),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.cloud_done_rounded,
              size: 12,
              color: colorScheme.success,
            ),
            const SizedBox(width: 4),
            Text(
              'Synced',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: colorScheme.success,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: colorScheme.warning.withAlpha(30),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.cloud_upload_rounded,
            size: 12,
            color: colorScheme.warning,
          ),
          const SizedBox(width: 4),
          Text(
            'Pending',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: colorScheme.warning,
            ),
          ),
        ],
      ),
    );
  }
}
