import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Large animated scan button for the home screen
class ScanButton extends StatefulWidget {
  final VoidCallback onPressed;
  final bool isProcessing;

  const ScanButton({
    super.key,
    required this.onPressed,
    this.isProcessing = false,
  });

  @override
  State<ScanButton> createState() => _ScanButtonState();
}

class _ScanButtonState extends State<ScanButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.08).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        return Transform.scale(
          scale: widget.isProcessing ? 1.0 : _pulseAnimation.value,
          child: GestureDetector(
            onTap: widget.isProcessing ? null : widget.onPressed,
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: widget.isProcessing
                      ? [Colors.grey.shade400, Colors.grey.shade600]
                      : [AppColors.primary, AppTheme.primaryDark],
                ),
                border: Border.all(
                  color: widget.isProcessing
                      ? Colors.grey.shade700
                      : AppColors.secondary,
                  width: 3,
                ),
                boxShadow: [
                  BoxShadow(
                    color:
                        (widget.isProcessing ? Colors.grey : AppColors.primary)
                            .withAlpha(102),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Outer ring
                  Container(
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.white.withAlpha(64),
                        width: 2,
                      ),
                    ),
                  ),

                  // Inner content
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (widget.isProcessing)
                        const SizedBox(
                          width: 40,
                          height: 40,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 3,
                          ),
                        )
                      else
                        const Icon(
                          Icons.qr_code_scanner_rounded,
                          size: 56,
                          color: Colors.white,
                        ),
                      const SizedBox(height: 8),
                      Text(
                        widget.isProcessing ? 'SCANNING...' : 'SCAN QR',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
