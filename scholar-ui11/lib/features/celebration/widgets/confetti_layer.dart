import 'dart:math';
import 'package:flutter/material.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';

class _ConfettiPiece {
  final double startX; // 0..1 fraction of layer width
  final double phase; // 0..1 offset into the fall cycle
  final double size;
  final double spinTurns;
  final bool isCircle;
  final Color color;

  const _ConfettiPiece({
    required this.startX,
    required this.phase,
    required this.size,
    required this.spinTurns,
    required this.isCircle,
    required this.color,
  });
}

/// Continuously falling confetti behind the celebration content. Driven by a
/// single repeating [AnimationController] with a fixed seed, so it's cheap
/// and fully deterministic (important for widget tests, which advance time
/// in fixed steps rather than real wall-clock ticks).
class ConfettiLayer extends StatefulWidget {
  final int pieceCount;

  const ConfettiLayer({super.key, this.pieceCount = 26});

  @override
  State<ConfettiLayer> createState() => _ConfettiLayerState();
}

class _ConfettiLayerState extends State<ConfettiLayer>
    with SingleTickerProviderStateMixin {
  static const _palette = [
    AppColors.primary,
    AppColors.secondary,
    AppColors.success,
    AppColors.teal,
    AppColors.mustard,
  ];

  late final AnimationController _controller;
  late final List<_ConfettiPiece> _pieces;

  @override
  void initState() {
    super.initState();
    final random = Random(7); // fixed seed: stable, deterministic layout
    _pieces = List.generate(widget.pieceCount, (i) {
      return _ConfettiPiece(
        startX: random.nextDouble(),
        phase: random.nextDouble(),
        size: 5 + random.nextDouble() * 5,
        spinTurns: 1 + random.nextDouble() * 2,
        isCircle: random.nextBool(),
        color: _palette[i % _palette.length],
      );
    });
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 5))
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
          painter: _ConfettiPainter(pieces: _pieces, t: _controller.value),
          size: Size.infinite,
        ),
      ),
    );
  }
}

class _ConfettiPainter extends CustomPainter {
  final List<_ConfettiPiece> pieces;
  final double t; // 0..1, current animation value

  _ConfettiPainter({required this.pieces, required this.t});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    for (final p in pieces) {
      final localT = (t + p.phase) % 1.0;
      final y = localT * (size.height + p.size * 2) - p.size;
      final x = p.startX * size.width + sin(localT * 4 * pi) * 10;
      final angle = localT * p.spinTurns * 2 * pi;

      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(angle);
      paint.color = p.color;
      if (p.isCircle) {
        canvas.drawCircle(Offset.zero, p.size / 2, paint);
      } else {
        canvas.drawRect(
          Rect.fromCenter(center: Offset.zero, width: p.size, height: p.size * 1.6),
          paint,
        );
      }
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter oldDelegate) => oldDelegate.t != t;
}
