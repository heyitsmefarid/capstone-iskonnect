import 'package:flutter/material.dart';
import '../services/connectivity_service.dart';
import '../theme/app_theme.dart';

/// Widget that displays the current connection status
class ConnectionStatusIndicator extends StatelessWidget {
  final ConnectivityService connectivityService;
  final bool showText;
  final bool compact;

  const ConnectionStatusIndicator({
    super.key,
    required this.connectivityService,
    this.showText = true,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: connectivityService,
      builder: (context, _) {
        return _buildIndicator(context);
      },
    );
  }

  Widget _buildIndicator(BuildContext context) {
    final status = connectivityService.status;
    final colorScheme = Theme.of(context).colorScheme;

    Color statusColor;
    IconData statusIcon;
    String statusText;

    switch (status) {
      case ConnectionStatus.online:
        statusColor = colorScheme.success;
        statusIcon = Icons.cloud_done_rounded;
        statusText = 'Online';
        break;
      case ConnectionStatus.offline:
        statusColor = colorScheme.offline;
        statusIcon = Icons.cloud_off_rounded;
        statusText = 'Offline';
        break;
      case ConnectionStatus.syncing:
        statusColor = colorScheme.syncing;
        statusIcon = Icons.sync_rounded;
        statusText = 'Syncing...';
        break;
    }

    if (compact) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: statusColor.withAlpha(30),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (status == ConnectionStatus.syncing)
              SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation(statusColor),
                ),
              )
            else
              Icon(statusIcon, size: 14, color: statusColor),
            if (showText) ...[
              const SizedBox(width: 4),
              Text(
                statusText,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: statusColor,
                ),
              ),
            ],
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: statusColor.withAlpha(25),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor.withAlpha(77), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (status == ConnectionStatus.syncing)
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                valueColor: AlwaysStoppedAnimation(statusColor),
              ),
            )
          else
            Icon(statusIcon, size: 20, color: statusColor),
          if (showText) ...[
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  statusText,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: statusColor,
                  ),
                ),
                if (connectivityService.isOnline)
                  Text(
                    connectivityService.connectionTypeText,
                    style: TextStyle(
                      fontSize: 11,
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
