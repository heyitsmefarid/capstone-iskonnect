import 'dart:math';
import 'package:flutter/material.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';

class _BurstSpec {
  final double startFraction; // 0..1, when in the cycle this burst starts
  final Offset origin; // fractional position within the layer (0..1, 0..1)
  final Color color;

  const _BurstSpec({
    required this.startFraction,
    required this.origin,
    required this.color,
  });
}

/// A handful of firework bursts that repeat on a loop: each rises briefly
/// then radiates outward and fades — purely decorative background motion for
/// the celebration screen. Driven by one repeating [AnimationController], so
/// it's cheap and fully deterministic (no `Timer`s, no wall-clock reliance).
class FireworkLayer extends StatefulWidget {
  const FireworkLayer({super.key});

  @override
  State<FireworkLayer> createState() => _FireworkLayerState();
}

class _FireworkLayerState extends State<FireworkLayer>
    with SingleTickerProviderStateMixin {
  static const _cycleDuration = Duration(milliseconds: 3600);
  static const _riseFraction = 0.10; // fraction of the cycle spent rising
  static const _burstFraction = 0.28; // fraction of the cycle spent radiating

  static const _bursts = [
    _BurstSpec(startFraction: 0.00, origin: Offset(0.22, 0.30), color: AppColors.mustard),
    _BurstSpec(startFraction: 0.15, origin: Offset(0.72, 0.22), color: AppColors.success),
    _BurstSpec(startFraction: 0.32, origin: Offset(0.45, 0.38), color: AppColors.primary),
    _BurstSpec(startFraction: 0.50, origin: Offset(0.82, 0.42), color: AppColors.secondaryDark),
    _BurstSpec(startFraction: 0.68, origin: Offset(0.30, 0.20), color: AppColors.success),
  ];

  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: _cycleDuration)
      ..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => CustomPaint(
          painter: _FireworkPainter(
            bursts: _bursts,
            t: _controller.value,
            riseFraction: _riseFraction,
            burstFraction: _burstFraction,
          ),
          size: Size.infinite,
        ),
      ),
    );
  }
}

class _FireworkPainter extends CustomPainter {
  final List<_BurstSpec> bursts;
  final double t; // 0..1 within the current cycle
  final double riseFraction;
  final double burstFraction;

  _FireworkPainter({
    required this.bursts,
    required this.t,
    required this.riseFraction,
    required this.burstFraction,
  });

  static const _particlesPerBurst = 14;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    final totalFraction = riseFraction + burstFraction;

    for (final burst in bursts) {
      final localT = (t - burst.startFraction) % 1.0;
      if (localT > totalFraction) continue; // not active right now

      final center = Offset(burst.origin.dx * size.width, burst.origin.dy * size.height);

      if (localT < riseFraction) {
        final riseT = riseFraction == 0 ? 1.0 : localT / riseFraction;
        final start = Offset(center.dx, size.height + 12);
        final pos = Offset.lerp(start, center, riseT)!;
        paint.color = burst.color;
        canvas.drawCircle(pos, 2.4, paint);
      } else {
        final burstT = (localT - riseFraction) / burstFraction;
        final radius = 8 + burstT * 40;
        final opacity = (1 - burstT).clamp(0.0, 1.0);
        paint.color = burst.color.withValues(alpha: opacity);
        for (var i = 0; i < _particlesPerBurst; i++) {
          final angle = (2 * pi * i) / _particlesPerBurst;
          final offset = center + Offset(cos(angle), sin(angle)) * radius;
          canvas.drawCircle(offset, 2.5, paint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _FireworkPainter oldDelegate) => oldDelegate.t != t;
}
