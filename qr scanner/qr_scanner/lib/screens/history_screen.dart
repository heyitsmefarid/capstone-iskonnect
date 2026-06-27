import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../providers/providers.dart';
import '../services/services.dart';
import '../widgets/widgets.dart';
import '../utils/date_utils.dart';
import '../theme/app_theme.dart';

/// History screen showing all attendance records
class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  DateTime? _selectedDate;
  bool _showOnlyUnsynced = false;
  String? _selectedEventName;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final attendanceProvider = context.watch<AttendanceProvider>();
    final syncService = context.read<SyncService>();
    final connectivityService = context.read<ConnectivityService>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance History'),
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
        actions: [
          // Sync now
          ListenableBuilder(
            listenable: Listenable.merge([syncService, connectivityService]),
            builder: (context, _) {
              return IconButton(
                icon: syncService.isSyncing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.sync_rounded),
                tooltip: 'Sync now',
                onPressed:
                    connectivityService.isOnline && !syncService.isSyncing
                    ? () async {
                        final result = await syncService.syncNow();
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(result.toString()),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        }
                      }
                    : null,
              );
            },
          ),
          // Clear data
          IconButton(
            icon: Icon(Icons.delete_sweep_rounded, color: colorScheme.error),
            tooltip: 'Clear all data',
            onPressed: () => _showClearDataDialog(context, attendanceProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter chips
          _buildFilterChips(context, attendanceProvider),

          // Records list
          Expanded(child: _buildRecordsList(context, attendanceProvider)),
        ],
      ),
    );
  }

  Widget _buildFilterChips(BuildContext context, AttendanceProvider provider) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          // Date filter chip
          if (_selectedDate != null)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Chip(
                label: Text(DateTimeUtils.formatDate(_selectedDate!)),
                deleteIcon: const Icon(Icons.close, size: 18),
                onDeleted: () {
                  setState(() {
                    _selectedDate = null;
                  });
                },
              ),
            ),

          // Unsynced filter chip
          if (_showOnlyUnsynced)
            Chip(
              label: const Text('Unsynced only'),
              deleteIcon: const Icon(Icons.close, size: 18),
              onDeleted: () {
                setState(() {
                  _showOnlyUnsynced = false;
                });
              },
              backgroundColor: colorScheme.warning.withAlpha(30),
            ),

          // Event filter chip
          if (_selectedEventName != null)
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Chip(
                label: Text(_selectedEventName!),
                deleteIcon: const Icon(Icons.close, size: 18),
                onDeleted: () {
                  setState(() {
                    _selectedEventName = null;
                  });
                },
              ),
            ),

          const Spacer(),

          // Record count
          Text(
            '${_getFilteredRecords(provider).length} records',
            style: TextStyle(fontSize: 14, color: colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  List<AttendanceRecord> _getFilteredRecords(AttendanceProvider provider) {
    var records = provider.allRecords;

    // Filter by date
    if (_selectedDate != null) {
      records = provider.getRecordsByDate(_selectedDate!);
    }

    // Filter by sync status
    if (_showOnlyUnsynced) {
      records = records.where((r) => !r.isSynced).toList();
    }

    // Filter by event
    if (_selectedEventName != null) {
      records = records
          .where((r) => r.eventName == _selectedEventName)
          .toList();
    }

    // Sort by date (newest first)
    records.sort((a, b) => b.scanDateTime.compareTo(a.scanDateTime));

    return records;
  }

  Widget _buildRecordsList(BuildContext context, AttendanceProvider provider) {
    final records = _getFilteredRecords(provider);
    final colorScheme = Theme.of(context).colorScheme;

    if (records.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.history_rounded,
              size: 64,
              color: colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 16),
            Text(
              'No attendance records found',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w500,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            if (_selectedDate != null || _showOnlyUnsynced)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: TextButton(
                  onPressed: () {
                    setState(() {
                      _selectedDate = null;
                      _showOnlyUnsynced = false;
                    });
                  },
                  child: const Text('Clear filters'),
                ),
              ),
          ],
        ),
      );
    }

    // Group by date
    final groupedRecords = _groupRecordsByDate(records);

    return RefreshIndicator(
      onRefresh: () async {
        await provider.refresh();
      },
      child: ListView.builder(
        padding: const EdgeInsets.only(bottom: 16),
        itemCount: groupedRecords.length,
        itemBuilder: (context, index) {
          final dateKey = groupedRecords.keys.elementAt(index);
          final dateRecords = groupedRecords[dateKey]!;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Date header
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Row(
                  children: [
                    Text(
                      _getDateLabel(dateKey),
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: colorScheme.primary,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${dateRecords.length}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: colorScheme.primary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Records for this date
              ...dateRecords.map(
                (record) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: AttendanceCard(
                    record: record,
                    onTap: () => _showRecordDetails(context, record),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Map<String, List<AttendanceRecord>> _groupRecordsByDate(
    List<AttendanceRecord> records,
  ) {
    final grouped = <String, List<AttendanceRecord>>{};

    for (final record in records) {
      final dateKey = record.dateKey;
      if (!grouped.containsKey(dateKey)) {
        grouped[dateKey] = [];
      }
      grouped[dateKey]!.add(record);
    }

    return grouped;
  }

  String _getDateLabel(String dateKey) {
    final date = DateTime.parse(dateKey);
    return DateTimeUtils.getDateLabel(date);
  }

  void _showClearDataDialog(BuildContext context, AttendanceProvider provider) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear all data?'),
        content: const Text(
          'This will permanently delete all attendance records on this device. Synced records remain on the server.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await provider.clearAllData();
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('All local data cleared.'),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              }
            },
            child: const Text('Clear'),
          ),
        ],
      ),
    );
  }

  void _showRecordDetails(BuildContext context, AttendanceRecord record) {
    final colorScheme = Theme.of(context).colorScheme;

    showModalBottomSheet(
      context: context,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
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
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Attendance Record',
                            style: TextStyle(
                              fontSize: 12,
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ),
                          Text(
                            (record.studentName?.trim().isNotEmpty ?? false)
                                ? record.studentName!.trim()
                                : record.studentId,
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: colorScheme.onSurface,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            'ID: ${record.studentId}',
                            style: TextStyle(
                              fontSize: 12,
                              color: colorScheme.onSurfaceVariant,
                              fontFamily: 'monospace',
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                _buildDetailRow(
                  context,
                  Icons.event_rounded,
                  'Event',
                  record.eventName,
                ),
                if (record.schoolName != null && record.schoolName!.isNotEmpty)
                  _buildDetailRow(
                    context,
                    Icons.school_rounded,
                    'School',
                    record.schoolName!,
                  ),
                if (record.programName != null &&
                    record.programName!.isNotEmpty)
                  _buildDetailRow(
                    context,
                    Icons.menu_book_rounded,
                    'Program',
                    record.programName!,
                  ),
                _buildDetailRow(
                  context,
                  Icons.calendar_today_rounded,
                  'Date',
                  DateTimeUtils.formatDate(record.scanDateTime),
                ),
                _buildDetailRow(
                  context,
                  Icons.access_time_rounded,
                  'Time',
                  DateTimeUtils.formatTime(record.scanDateTime),
                ),
                _buildDetailRow(
                  context,
                  Icons.cloud_rounded,
                  'Sync Status',
                  record.isSynced ? 'Synced' : 'Pending',
                  valueColor: record.isSynced
                      ? colorScheme.success
                      : colorScheme.warning,
                ),
                if (record.syncedAt != null)
                  _buildDetailRow(
                    context,
                    Icons.sync_rounded,
                    'Synced At',
                    DateTimeUtils.formatDateTime(record.syncedAt!),
                  ),

                const SizedBox(height: 16),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDetailRow(
    BuildContext context,
    IconData icon,
    String label,
    String value, {
    Color? valueColor,
  }) {
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(icon, size: 20, color: colorScheme.onSurfaceVariant),
          const SizedBox(width: 12),
          SizedBox(
            width: 90,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                color: colorScheme.onSurfaceVariant,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: valueColor,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
