import 'package:flutter/material.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';

/// An animated ring that fills from 0 to [value]/[max] and counts the
/// number up at the same time. Used both for the hero Total Evaluation
/// Score (larger [diameter]) and the three breakdown scores on the
/// congratulations screen.
class ScoreRing extends StatelessWidget {
  final int value;
  final int max;
  final String label;
  final double diameter;
  final Duration fillDuration;

  const ScoreRing({
    super.key,
    required this.value,
    required this.max,
    required this.label,
    this.diameter = 66,
    this.fillDuration = const Duration(milliseconds: 1100),
  });

  @override
  Widget build(BuildContext context) {
    final target = max == 0 ? 0.0 : (value / max).clamp(0.0, 1.0);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: target),
          duration: fillDuration,
          curve: Curves.easeOutCubic,
          builder: (context, progress, child) {
            final shown = (progress * max).round();
            return SizedBox(
              width: diameter,
              height: diameter,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CircularProgressIndicator(
                    value: progress,
                    strokeWidth: 6,
                    backgroundColor: AppColors.surfaceVariant,
                    valueColor: const AlwaysStoppedAnimation(AppColors.success),
                  ),
                  Text(
                    '$shown/$max',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 12.5,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
        const SizedBox(height: 6),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 9.5,
            fontWeight: FontWeight.w700,
            color: AppColors.textSecondary,
            letterSpacing: .3,
          ),
        ),
      ],
    );
  }
}
