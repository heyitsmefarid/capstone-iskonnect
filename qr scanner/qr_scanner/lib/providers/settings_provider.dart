import 'package:flutter/material.dart';
import '../services/services.dart';

/// Provider for managing app settings and theme.
class SettingsProvider extends ChangeNotifier {
  final StorageService _storageService = StorageService();

  ThemeMode _themeMode = ThemeMode.system;
  bool _autoSync = true;
  String _apiEndpoint = 'https://api.iskonnect.edu/v1';

  /// Current theme mode
  ThemeMode get themeMode => _themeMode;

  /// Whether dark mode is enabled
  bool get isDarkMode => _themeMode == ThemeMode.dark;

  /// Whether auto-sync is enabled
  bool get autoSync => _autoSync;

  /// API endpoint
  String get apiEndpoint => _apiEndpoint;

  /// Initialize settings from storage
  Future<void> initialize() async {
    final isDark = _storageService.isDarkMode();
    _themeMode = isDark ? ThemeMode.dark : ThemeMode.light;
    _autoSync = _storageService.isAutoSyncEnabled();
    _apiEndpoint = _storageService.getApiEndpoint();
    notifyListeners();
  }

  /// Toggle theme mode
  Future<void> toggleTheme() async {
    if (_themeMode == ThemeMode.dark) {
      _themeMode = ThemeMode.light;
      await _storageService.setDarkMode(false);
    } else {
      _themeMode = ThemeMode.dark;
      await _storageService.setDarkMode(true);
    }
    notifyListeners();
  }

  /// Set theme mode
  Future<void> setThemeMode(ThemeMode mode) async {
    _themeMode = mode;
    await _storageService.setDarkMode(mode == ThemeMode.dark);
    notifyListeners();
  }

  /// Toggle auto-sync
  Future<void> toggleAutoSync() async {
    _autoSync = !_autoSync;
    await _storageService.setAutoSync(_autoSync);
    notifyListeners();
  }

  /// Set auto-sync
  Future<void> setAutoSync(bool value) async {
    _autoSync = value;
    await _storageService.setAutoSync(value);
    notifyListeners();
  }

  /// Set API endpoint
  Future<void> setApiEndpoint(String endpoint) async {
    _apiEndpoint = endpoint;
    await _storageService.setApiEndpoint(endpoint);
    notifyListeners();
  }
}
