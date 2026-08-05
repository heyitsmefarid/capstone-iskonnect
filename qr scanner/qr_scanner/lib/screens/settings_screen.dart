import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/providers.dart';
import '../services/services.dart';
import '../theme/app_theme.dart';

/// Settings screen for app configuration
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final settingsProvider = context.watch<SettingsProvider>();
    final connectivityService = context.read<ConnectivityService>();
    final syncService = context.read<SyncService>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        backgroundColor: colorScheme.surface,
        foregroundColor: colorScheme.onSurface,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Sync section
          _buildSectionHeader(context, 'Sync Settings'),
          _buildSyncCard(context, syncService, connectivityService),
          const SizedBox(height: 24),

          // Appearance section
          _buildSectionHeader(context, 'Appearance'),
          _buildAppearanceCard(context, settingsProvider),
          const SizedBox(height: 24),

          // Data section
          _buildSectionHeader(context, 'Data Management'),
          _buildDataCard(context),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: Theme.of(context).colorScheme.primary,
        ),
      ),
    );
  }

  Widget _buildSyncCard(
    BuildContext context,
    SyncService syncService,
    ConnectivityService connectivityService,
  ) {
    final colorScheme = Theme.of(context).colorScheme;
    final settingsProvider = context.watch<SettingsProvider>();

    return Card(
      child: Column(
        children: [
          // Sync status
          ListenableBuilder(
            listenable: syncService,
            builder: (context, _) {
              final pending = syncService.pendingCount;
              return ListTile(
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: pending > 0
                        ? colorScheme.warning.withAlpha(30)
                        : colorScheme.success.withAlpha(30),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    pending > 0
                        ? Icons.cloud_upload_rounded
                        : Icons.cloud_done_rounded,
                    color: pending > 0
                        ? colorScheme.warning
                        : colorScheme.success,
                  ),
                ),
                title: const Text('Sync Status'),
                subtitle: Text(
                  pending > 0 ? '$pending records pending' : 'All synced',
                ),
                trailing: syncService.isSyncing
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : null,
              );
            },
          ),
          const Divider(height: 1),

          // Auto-sync toggle
          SwitchListTile(
            secondary: const Icon(Icons.sync_rounded),
            title: const Text('Auto Sync'),
            subtitle: const Text('Automatically sync when online'),
            value: settingsProvider.autoSync,
            onChanged: (value) => settingsProvider.setAutoSync(value),
          ),
          const Divider(height: 1),

          // Manual sync button
          ListenableBuilder(
            listenable: Listenable.merge([syncService, connectivityService]),
            builder: (context, _) {
              return ListTile(
                leading: const Icon(Icons.sync_rounded),
                title: const Text('Sync Now'),
                subtitle: Text(
                  connectivityService.isOnline
                      ? 'Tap to sync pending records'
                      : 'No internet connection',
                ),
                trailing: ElevatedButton(
                  onPressed:
                      connectivityService.isOnline &&
                          !syncService.isSyncing &&
                          syncService.pendingCount > 0
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
                  child: const Text('Sync'),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildAppearanceCard(
    BuildContext context,
    SettingsProvider settingsProvider,
  ) {
    return Card(
      child: Column(
        children: [
          SwitchListTile(
            secondary: Icon(
              settingsProvider.isDarkMode
                  ? Icons.dark_mode_rounded
                  : Icons.light_mode_rounded,
            ),
            title: const Text('Dark Mode'),
            subtitle: Text(
              settingsProvider.isDarkMode
                  ? 'Dark theme enabled'
                  : 'Light theme enabled',
            ),
            value: settingsProvider.isDarkMode,
            onChanged: (_) => settingsProvider.toggleTheme(),
          ),
        ],
      ),
    );
  }

  Widget _buildDataCard(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final attendanceProvider = context.read<AttendanceProvider>();

    return Card(
      child: Column(
        children: [
          ListTile(
            leading: Icon(Icons.delete_sweep_rounded, color: colorScheme.error),
            title: Text(
              'Clear All Data',
              style: TextStyle(color: colorScheme.error),
            ),
            subtitle: const Text('Delete all attendance records'),
            onTap: () => _showClearDataDialog(context, attendanceProvider),
          ),
        ],
      ),
    );
  }

  void _showClearDataDialog(BuildContext context, AttendanceProvider provider) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Clear All Data'),
          content: const Text(
            'Are you sure you want to delete all attendance records? This action cannot be undone.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.error,
              ),
              onPressed: () async {
                await provider.clearAllData();
                if (context.mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('All data cleared'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
              child: const Text('Delete All'),
            ),
          ],
        );
      },
    );
  }
}
