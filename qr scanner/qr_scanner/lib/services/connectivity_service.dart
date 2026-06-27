import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// Enum representing the current connectivity status
enum ConnectionStatus { online, offline, syncing }

/// Service for monitoring network connectivity.
/// Provides real-time updates on connection status and triggers sync when online.
class ConnectivityService extends ChangeNotifier {
  // Singleton pattern
  static final ConnectivityService _instance = ConnectivityService._internal();
  factory ConnectivityService() => _instance;
  ConnectivityService._internal();

  final Connectivity _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  ConnectionStatus _status = ConnectionStatus.offline;
  List<ConnectivityResult> _connectionTypes = [];
  bool _isInitialized = false;

  /// Current connection status
  ConnectionStatus get status => _status;

  /// Whether we have internet connection
  bool get isOnline => _status == ConnectionStatus.online;

  /// Whether we're currently syncing
  bool get isSyncing => _status == ConnectionStatus.syncing;

  /// Whether we're offline
  bool get isOffline => _status == ConnectionStatus.offline;

  /// Current connection types
  List<ConnectivityResult> get connectionTypes => _connectionTypes;

  /// Human-readable status text
  String get statusText {
    switch (_status) {
      case ConnectionStatus.online:
        return 'Online';
      case ConnectionStatus.offline:
        return 'Offline';
      case ConnectionStatus.syncing:
        return 'Syncing...';
    }
  }

  /// Initialize the connectivity service
  Future<void> initialize() async {
    if (_isInitialized) return;

    // Get initial connectivity status
    _connectionTypes = await _connectivity.checkConnectivity();
    _updateStatus(_connectionTypes);

    // Listen for connectivity changes
    _subscription = _connectivity.onConnectivityChanged.listen(
      _handleConnectivityChange,
    );

    _isInitialized = true;
  }

  /// Handle connectivity changes
  void _handleConnectivityChange(List<ConnectivityResult> results) {
    _connectionTypes = results;
    _updateStatus(results);
    notifyListeners();
  }

  /// Update the connection status based on results
  void _updateStatus(List<ConnectivityResult> results) {
    // If syncing, don't change status
    if (_status == ConnectionStatus.syncing) return;

    if (results.contains(ConnectivityResult.none) || results.isEmpty) {
      _status = ConnectionStatus.offline;
    } else {
      _status = ConnectionStatus.online;
    }
  }

  /// Set syncing status
  void setSyncing(bool syncing) {
    if (syncing) {
      _status = ConnectionStatus.syncing;
    } else {
      // Restore actual connection status
      _updateStatus(_connectionTypes);
    }
    notifyListeners();
  }

  /// Check current connectivity
  Future<bool> checkConnectivity() async {
    final results = await _connectivity.checkConnectivity();
    _connectionTypes = results;
    _updateStatus(results);
    notifyListeners();
    return isOnline;
  }

  /// Get connection type as string
  String get connectionTypeText {
    if (_connectionTypes.isEmpty ||
        _connectionTypes.contains(ConnectivityResult.none)) {
      return 'No Connection';
    }

    final types = <String>[];
    for (final type in _connectionTypes) {
      switch (type) {
        case ConnectivityResult.wifi:
          types.add('WiFi');
          break;
        case ConnectivityResult.mobile:
          types.add('Mobile');
          break;
        case ConnectivityResult.ethernet:
          types.add('Ethernet');
          break;
        case ConnectivityResult.vpn:
          types.add('VPN');
          break;
        case ConnectivityResult.bluetooth:
          types.add('Bluetooth');
          break;
        case ConnectivityResult.other:
          types.add('Other');
          break;
        case ConnectivityResult.none:
          break;
      }
    }

    return types.join(', ');
  }

  /// Dispose of resources
  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
