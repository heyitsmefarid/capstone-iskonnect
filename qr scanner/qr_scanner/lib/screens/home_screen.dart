import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/providers.dart';
import '../services/services.dart';
import '../widgets/widgets.dart';
import '../theme/app_theme.dart';
import '../utils/date_utils.dart';
import 'scanner_screen.dart';
import 'history_screen.dart';

/// Main home screen with dashboard, scan button, and navigation
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [_DashboardTab(), HistoryScreen()];

  void _switchToTab(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard_rounded),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history_rounded),
            label: 'History',
          ),
        ],
      ),
    );
  }
}

/// Dashboard tab content
class _DashboardTab extends StatelessWidget {
  const _DashboardTab();

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final attendanceProvider = context.watch<AttendanceProvider>();
    final connectivityService = context.read<ConnectivityService>();
    final syncService = context.read<SyncService>();
    final settingsProvider = context.watch<SettingsProvider>();

    return SafeArea(
      child: CustomScrollView(
        slivers: [
          // App Bar
          SliverAppBar(
            floating: true,
            backgroundColor: colorScheme.surface,
            surfaceTintColor: Colors.transparent,
            title: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.qr_code_scanner_rounded,
                    color: colorScheme.onPrimaryContainer,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ISKONNECT',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: colorScheme.onSurface,
                      ),
                    ),
                    Text(
                      'Attendance Scanner',
                      style: TextStyle(
                        fontSize: 12,
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: Icon(
                  settingsProvider.isDarkMode
                      ? Icons.light_mode_rounded
                      : Icons.dark_mode_rounded,
                ),
                tooltip: settingsProvider.isDarkMode
                    ? 'Light mode'
                    : 'Dark mode',
                onPressed: () => settingsProvider.toggleTheme(),
              ),
              ConnectionStatusIndicator(
                connectivityService: connectivityService,
                compact: true,
              ),
              const SizedBox(width: 8),
            ],
          ),

          // Content
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // Event card
                _buildCurrentEventCard(context, attendanceProvider),
                const SizedBox(height: 16),

                // Stats grid
                _buildStatsGrid(context, attendanceProvider, syncService),
                const SizedBox(height: 24),

                // Scan button section
                _buildScanSection(context),
                const SizedBox(height: 24),

                // Recent scans
                _buildRecentScans(context, attendanceProvider),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCurrentEventCard(
    BuildContext context,
    AttendanceProvider provider,
  ) {
    final colorScheme = Theme.of(context).colorScheme;
    final event = provider.currentEvent;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: colorScheme.secondaryContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.event_rounded,
                color: colorScheme.onSecondaryContainer,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Current Event',
                    style: TextStyle(
                      fontSize: 12,
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    event?.name ?? 'General Attendance',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (event != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      DateTimeUtils.formatDate(event.date),
                      style: TextStyle(
                        fontSize: 12,
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            TextButton(
              onPressed: () => _showEventSelector(context),
              child: const Text('Manage'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsGrid(
    BuildContext context,
    AttendanceProvider provider,
    SyncService syncService,
  ) {
    final colorScheme = Theme.of(context).colorScheme;

    return Row(
      children: [
        Expanded(
          child: StatsCard(
            title: 'Activity Scans',
            value: provider.todayCount.toString(),
            icon: Icons.people_rounded,
            iconColor: colorScheme.primary,
            onTap: () => _navigateToHistoryTab(context),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: ListenableBuilder(
            listenable: syncService,
            builder: (context, _) {
              final pending = syncService.pendingCount;
              return StatsCard(
                title: 'Pending Sync',
                value: pending.toString(),
                icon: Icons.cloud_upload_rounded,
                iconColor: pending > 0
                    ? colorScheme.warning
                    : colorScheme.success,
                onTap: () => _navigateToHistoryTab(context),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildScanSection(BuildContext context) {
    return Column(
      children: [
        Text(
          'Tap to scan student QR code',
          style: TextStyle(
            fontSize: 16,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 20),
        Center(child: ScanButton(onPressed: () => _openScanner(context))),
      ],
    );
  }

  Widget _buildRecentScans(BuildContext context, AttendanceProvider provider) {
    final colorScheme = Theme.of(context).colorScheme;
    final recentRecords = provider.todayRecords.take(5).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Recent Activity Scans',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: colorScheme.onSurface,
              ),
            ),
            if (recentRecords.isNotEmpty)
              TextButton(
                onPressed: () {
                  // Navigate to history tab using the HomeScreen's navigation
                  _navigateToHistoryTab(context);
                },
                child: const Text('View All'),
              ),
          ],
        ),
        const SizedBox(height: 8),
        if (recentRecords.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Center(
                child: Column(
                  children: [
                    Icon(
                      Icons.qr_code_scanner_rounded,
                      size: 48,
                      color: colorScheme.onSurfaceVariant,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'No activity scans yet',
                      style: TextStyle(
                        fontSize: 16,
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Tap the scan button to get started',
                      style: TextStyle(
                        fontSize: 14,
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          ...recentRecords.map((record) => AttendanceCard(record: record)),
      ],
    );
  }

  void _openScanner(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const ScannerScreen()),
    );
  }

  void _navigateToHistoryTab(BuildContext context) {
    // Find the HomeScreen ancestor and switch to history tab
    final homeState = context.findAncestorStateOfType<_HomeScreenState>();
    homeState?._switchToTab(1);
  }

  void _showEventSelector(BuildContext context) {
    final attendanceProvider = context.read<AttendanceProvider>();
    final colorScheme = Theme.of(context).colorScheme;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return SafeArea(
          child: SizedBox(
            height: MediaQuery.of(context).size.height * 0.75,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      const Text(
                        'Select Event',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Spacer(),
                      TextButton.icon(
                        onPressed: () => _showAddEventDialog(context),
                        icon: Icon(
                          Icons.add_rounded,
                          color: colorScheme.primary,
                        ),
                        label: const Text('Add Event'),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: Icon(Icons.close, color: colorScheme.onSurface),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: Consumer<AttendanceProvider>(
                    builder: (context, provider, _) {
                      final events = provider.events;

                      return ListView.builder(
                        itemCount: events.length,
                        itemBuilder: (context, index) {
                          final event = events[index];
                          final isSelected =
                              event.id == provider.currentEvent?.id;

                          return ListTile(
                            leading: Icon(
                              Icons.event_rounded,
                              color: isSelected
                                  ? Theme.of(context).colorScheme.primary
                                  : colorScheme.onSurfaceVariant,
                            ),
                            title: Text(event.name),
                            subtitle: Text(
                              DateTimeUtils.formatDate(event.date),
                            ),
                            trailing: isSelected
                                ? Icon(
                                    Icons.check_circle_rounded,
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.primary,
                                  )
                                : null,
                            onTap: () {
                              attendanceProvider.setCurrentEvent(event);
                              Navigator.pop(context);
                            },
                          );
                        },
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

  Future<void> _showAddEventDialog(BuildContext context) async {
    final attendanceProvider = context.read<AttendanceProvider>();
    final colorScheme = Theme.of(context).colorScheme;
    final eventNameController = TextEditingController();
    final eventDescriptionController = TextEditingController();
    DateTime selectedDate = DateTime.now();

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Add Event'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: eventNameController,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(
                        labelText: 'Event Name',
                        hintText: 'e.g., Youth Seminar',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: eventDescriptionController,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(
                        labelText: 'Description (Optional)',
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 12),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Event Date'),
                      subtitle: Text(DateTimeUtils.formatDate(selectedDate)),
                      trailing: Icon(
                        Icons.calendar_month_rounded,
                        color: colorScheme.onSurfaceVariant,
                      ),
                      onTap: () async {
                        final pickedDate = await showDatePicker(
                          context: context,
                          initialDate: selectedDate,
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2100),
                        );

                        if (pickedDate != null) {
                          setDialogState(() {
                            selectedDate = pickedDate;
                          });
                        }
                      },
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () async {
                    final eventName = eventNameController.text.trim();
                    if (eventName.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Event name is required')),
                      );
                      return;
                    }

                    await attendanceProvider.addEvent(
                      name: eventName,
                      description: eventDescriptionController.text,
                      date: selectedDate,
                      setAsCurrent: true,
                    );

                    if (context.mounted) {
                      Navigator.pop(dialogContext);
                    }
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
}
