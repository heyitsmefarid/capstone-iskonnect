import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import '../providers/providers.dart';
import '../theme/app_theme.dart';
import '../utils/date_utils.dart';
import '../widgets/widgets.dart';

/// QR Code Scanner Screen with camera preview and scan feedback
class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen>
    with WidgetsBindingObserver {
  late MobileScannerController _scannerController;
  bool _isProcessing = false;
  bool _showFeedback = false;
  ScanResult? _lastResult;
  bool _torchEnabled = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _scannerController = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      // Laptops/desktops (web) typically only have a front-facing webcam, so a
      // "back" camera request fails to initialize. Use the front camera on web
      // and the back camera on mobile devices.
      facing: kIsWeb ? CameraFacing.front : CameraFacing.back,
      torchEnabled: false,
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      _scannerController.stop();
    } else if (state == AppLifecycleState.resumed) {
      _scannerController.start();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _scannerController.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    // Prevent multiple scans while processing
    if (_isProcessing || _showFeedback) return;

    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final barcode = barcodes.first;
    final String? code = barcode.rawValue;

    if (code == null || code.isEmpty) return;

    setState(() {
      _isProcessing = true;
    });

    // Process the QR code
    final attendanceProvider = context.read<AttendanceProvider>();
    final result = await attendanceProvider.processQrCode(code);

    if (!mounted) return;

    setState(() {
      _isProcessing = false;
      _showFeedback = true;
      _lastResult = result;
    });

    // Add haptic feedback
    // HapticFeedback is already triggered by the scanner

    // Auto-hide feedback after delay
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          _showFeedback = false;
          _lastResult = null;
        });
      }
    });
  }

  void _toggleTorch() {
    _scannerController.toggleTorch();
    setState(() {
      _torchEnabled = !_torchEnabled;
    });
  }

  void _switchCamera() {
    _scannerController.switchCamera();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Camera preview
          MobileScanner(
            controller: _scannerController,
            onDetect: _onDetect,
            errorBuilder: (context, error, child) =>
                _buildCameraError(context, error),
          ),

          // Overlay with scan frame
          _buildScanOverlay(context),

          // Top bar
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Back button
                  _buildCircularButton(
                    icon: Icons.arrow_back_rounded,
                    onPressed: () => Navigator.pop(context),
                  ),

                  // Camera controls
                  Row(
                    children: [
                      _buildCircularButton(
                        icon: Icons.event_rounded,
                        onPressed: () => _showEventSelector(context),
                      ),
                      const SizedBox(width: 12),
                      _buildCircularButton(
                        icon: _torchEnabled
                            ? Icons.flash_on_rounded
                            : Icons.flash_off_rounded,
                        onPressed: _toggleTorch,
                        isActive: _torchEnabled,
                      ),
                      const SizedBox(width: 12),
                      _buildCircularButton(
                        icon: Icons.flip_camera_ios_rounded,
                        onPressed: _switchCamera,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Processing indicator
          if (_isProcessing)
            Center(
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const CircularProgressIndicator(color: Colors.white),
                    const SizedBox(height: 16),
                    const Text(
                      'Processing...',
                      style: TextStyle(color: Colors.white),
                    ),
                  ],
                ),
              ),
            ),

          // Scan feedback overlay
          if (_showFeedback && _lastResult != null)
            Container(
              color: Colors.black54,
              child: Center(
                child: ScanFeedback(
                  isSuccess: _lastResult!.isSuccess,
                  isDuplicate: _lastResult!.isDuplicate,
                  message: _lastResult!.message,
                  studentId: _lastResult!.record?.studentId,
                  studentName: _lastResult!.record?.studentName,
                  schoolName: _lastResult!.record?.schoolName,
                  programName: _lastResult!.record?.programName,
                  onDismiss: () {
                    setState(() {
                      _showFeedback = false;
                      _lastResult = null;
                    });
                  },
                ),
              ),
            ),

          // Bottom info bar
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: _buildBottomBar(context),
          ),
        ],
      ),
    );
  }

  Widget _buildCircularButton({
    required IconData icon,
    required VoidCallback onPressed,
    bool isActive = false,
  }) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final backgroundColor = isActive
        ? colorScheme.secondary
        : (isDarkMode ? Colors.black54 : Colors.white54);
    final iconColor = isActive
        ? colorScheme.onSecondary
        : (isDarkMode ? Colors.white : Colors.black87);
    return Container(
      decoration: BoxDecoration(color: backgroundColor, shape: BoxShape.circle),
      child: IconButton(
        icon: Icon(icon, color: iconColor),
        onPressed: onPressed,
      ),
    );
  }

  /// Shown when the camera fails to initialize (permission denied, no camera,
  /// unsupported browser, etc). Surfaces the real error and offers a retry so
  /// the user isn't left staring at a blank screen.
  Widget _buildCameraError(BuildContext context, MobileScannerException error) {
    String message;
    switch (error.errorCode) {
      case MobileScannerErrorCode.permissionDenied:
        message =
            'Camera permission was denied.\nAllow camera access in your browser '
            '(click the camera icon in the address bar), then tap Retry.';
        break;
      case MobileScannerErrorCode.unsupported:
        // On web this is also reported when getUserMedia throws NotFoundError,
        // i.e. there is no camera connected/accessible.
        message =
            'No camera was found.\nConnect a webcam (or run the app on a phone '
            'with a camera), then tap Retry.\n\nDetails: '
            '${error.errorDetails?.message ?? error.errorCode.name}';
        break;
      default:
        message =
            'Could not start the camera.\n${error.errorDetails?.message ?? error.errorCode.name}';
    }

    return Container(
      color: Colors.black,
      padding: const EdgeInsets.all(32),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.videocam_off_rounded,
              color: Colors.white70,
              size: 64,
            ),
            const SizedBox(height: 20),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 15),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () => _scannerController.start(),
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScanOverlay(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final colorScheme = Theme.of(context).colorScheme;
        final scanAreaSize = constraints.maxWidth * 0.7;
        final left = (constraints.maxWidth - scanAreaSize) / 2;
        final top = (constraints.maxHeight - scanAreaSize) / 2 - 50;

        return Stack(
          children: [
            // Dark overlay around scan area
            ColorFiltered(
              colorFilter: const ColorFilter.mode(
                Colors.black87,
                BlendMode.srcOut,
              ),
              child: Stack(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.primary.withAlpha(230),
                      backgroundBlendMode: BlendMode.dstOut,
                    ),
                  ),
                  Positioned(
                    left: left,
                    top: top,
                    child: Container(
                      width: scanAreaSize,
                      height: scanAreaSize,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(28),
                        border: Border.all(
                          color: AppColors.secondary.withAlpha(204),
                          width: 2,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Scan frame corners
            Positioned(
              left: left,
              top: top,
              child: _buildCorner(CornerPosition.topLeft),
            ),
            Positioned(
              right: left,
              top: top,
              child: _buildCorner(CornerPosition.topRight),
            ),
            Positioned(
              left: left,
              bottom: constraints.maxHeight - top - scanAreaSize,
              child: _buildCorner(CornerPosition.bottomLeft),
            ),
            Positioned(
              right: left,
              bottom: constraints.maxHeight - top - scanAreaSize,
              child: _buildCorner(CornerPosition.bottomRight),
            ),

            // Instruction text
            Positioned(
              left: 0,
              right: 0,
              top: top + scanAreaSize + 30,
              child: Text(
                'Align QR code within the frame',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: colorScheme.onPrimary.withAlpha(230),
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildCorner(CornerPosition position) {
    const size = 40.0;
    const thickness = 4.0;
    final color = AppColors.secondary;

    BorderRadius borderRadius;
    switch (position) {
      case CornerPosition.topLeft:
        borderRadius = const BorderRadius.only(topLeft: Radius.circular(24));
        break;
      case CornerPosition.topRight:
        borderRadius = const BorderRadius.only(topRight: Radius.circular(24));
        break;
      case CornerPosition.bottomLeft:
        borderRadius = const BorderRadius.only(bottomLeft: Radius.circular(24));
        break;
      case CornerPosition.bottomRight:
        borderRadius = const BorderRadius.only(
          bottomRight: Radius.circular(24),
        );
        break;
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        border: Border(
          top:
              position == CornerPosition.topLeft ||
                  position == CornerPosition.topRight
              ? BorderSide(color: color, width: thickness)
              : BorderSide.none,
          bottom:
              position == CornerPosition.bottomLeft ||
                  position == CornerPosition.bottomRight
              ? BorderSide(color: color, width: thickness)
              : BorderSide.none,
          left:
              position == CornerPosition.topLeft ||
                  position == CornerPosition.bottomLeft
              ? BorderSide(color: color, width: thickness)
              : BorderSide.none,
          right:
              position == CornerPosition.topRight ||
                  position == CornerPosition.bottomRight
              ? BorderSide(color: color, width: thickness)
              : BorderSide.none,
        ),
        borderRadius: borderRadius,
      ),
    );
  }

  Widget _buildBottomBar(BuildContext context) {
    final attendanceProvider = context.watch<AttendanceProvider>();
    final selectedEvent = attendanceProvider.currentEvent;
    final eventLabel = selectedEvent == null
        ? 'General'
        : '${selectedEvent.name} • ${DateTimeUtils.formatShortDate(selectedEvent.date)}';

    return SafeArea(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.transparent,
              AppColors.primaryDark.withAlpha(204),
              AppColors.primaryDark,
            ],
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: _buildInfoChip(
                icon: Icons.event_rounded,
                label: eventLabel,
                onTap: () => _showEventSelector(context),
              ),
            ),
            const SizedBox(width: 8),
            _buildInfoChip(
              icon: Icons.people_rounded,
              label: '${attendanceProvider.todayCount} scanned',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoChip({
    required IconData icon,
    required String label,
    VoidCallback? onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(38),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: AppColors.secondary.withAlpha(178),
          width: 1.2,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: AppColors.secondary),
              const SizedBox(width: 8),
              Flexible(
                fit: FlexFit.loose,
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  softWrap: false,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
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
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
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

enum CornerPosition { topLeft, topRight, bottomLeft, bottomRight }
