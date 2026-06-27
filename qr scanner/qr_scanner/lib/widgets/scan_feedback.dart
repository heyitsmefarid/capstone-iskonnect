import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Widget for displaying scan result feedback with animations
class ScanFeedback extends StatefulWidget {
  final bool isSuccess;
  final bool isDuplicate;
  final String message;
  final String? studentId;
  final String? studentName;
  final String? schoolName;
  final String? programName;
  final VoidCallback? onDismiss;

  const ScanFeedback({
    super.key,
    required this.isSuccess,
    this.isDuplicate = false,
    required this.message,
    this.studentId,
    this.studentName,
    this.schoolName,
    this.programName,
    this.onDismiss,
  });

  @override
  State<ScanFeedback> createState() => _ScanFeedbackState();
}

class _ScanFeedbackState extends State<ScanFeedback>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 400),
      vsync: this,
    );

    _scaleAnimation = Tween<double>(
      begin: 0.5,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.elasticOut));

    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));

    _controller.forward();

    // Auto dismiss after 2 seconds
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        widget.onDismiss?.call();
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    Color backgroundColor;
    Color iconColor;
    IconData icon;

    if (widget.isSuccess) {
      backgroundColor = colorScheme.success;
      iconColor = Colors.white;
      icon = Icons.check_circle_rounded;
    } else if (widget.isDuplicate) {
      backgroundColor = colorScheme.warning;
      iconColor = Colors.white;
      icon = Icons.warning_rounded;
    } else {
      backgroundColor = colorScheme.error;
      iconColor = Colors.white;
      icon = Icons.error_rounded;
    }

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Opacity(
          opacity: _fadeAnimation.value,
          child: Transform.scale(
            scale: _scaleAnimation.value,
            child: Container(
              margin: const EdgeInsets.all(24),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: backgroundColor,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: backgroundColor.withAlpha(77),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Animated icon
                  TweenAnimationBuilder<double>(
                    duration: const Duration(milliseconds: 600),
                    tween: Tween(begin: 0, end: 1),
                    builder: (context, value, child) {
                      return Transform.scale(
                        scale: value,
                        child: Icon(icon, size: 80, color: iconColor),
                      );
                    },
                  ),
                  const SizedBox(height: 16),

                  // Status text
                  Text(
                    widget.isSuccess
                        ? 'SCAN SUCCESSFUL'
                        : widget.isDuplicate
                        ? 'DUPLICATE'
                        : 'ERROR',
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Message
                  Text(
                    widget.message,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.white.withAlpha(230),
                    ),
                  ),

                  // Student details if available
                  if (widget.studentName != null ||
                      widget.studentId != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withAlpha(51),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (widget.studentName != null)
                            Text(
                              widget.studentName!,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                          if (widget.studentId != null)
                            Text(
                              'ID: ${widget.studentId}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                                fontFamily: 'monospace',
                              ),
                            ),
                          if (widget.schoolName != null)
                            Text(
                              widget.schoolName!,
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.white.withAlpha(230),
                              ),
                            ),
                          if (widget.programName != null)
                            Text(
                              widget.programName!,
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.white.withAlpha(230),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
