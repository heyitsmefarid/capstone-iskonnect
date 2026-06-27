import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';

/// Animation Extension Methods for consistent animations across the app
extension AnimatedWidgetExtension on Widget {
  /// Fade and slide in from bottom with delay
  Widget fadeSlideIn({int delay = 0, int duration = 400}) {
    return animate(delay: Duration(milliseconds: delay))
        .fadeIn(duration: Duration(milliseconds: duration))
        .slideY(begin: 0.1, end: 0, duration: Duration(milliseconds: duration));
  }

  /// Fade and scale in
  Widget fadeScaleIn({int delay = 0, int duration = 350}) {
    return animate(delay: Duration(milliseconds: delay))
        .fadeIn(duration: Duration(milliseconds: duration))
        .scale(
          begin: const Offset(0.95, 0.95),
          end: const Offset(1, 1),
          duration: Duration(milliseconds: duration),
        );
  }

  /// Slide in from right
  Widget slideInRight({int delay = 0, int duration = 400}) {
    return animate(delay: Duration(milliseconds: delay))
        .fadeIn(duration: Duration(milliseconds: duration))
        .slideX(
          begin: 0.15,
          end: 0,
          duration: Duration(milliseconds: duration),
        );
  }

  /// Shimmer effect
  Widget shimmerEffect({int delay = 0}) {
    return animate(delay: Duration(milliseconds: delay)).shimmer(
      duration: const Duration(milliseconds: 1500),
      color: AppColors.secondary.withValues(alpha: 0.3),
    );
  }

  /// Bounce in effect
  Widget bounceIn({int delay = 0, int duration = 500}) {
    return animate(delay: Duration(milliseconds: delay))
        .fadeIn(duration: Duration(milliseconds: duration))
        .scale(
          begin: const Offset(0.8, 0.8),
          end: const Offset(1, 1),
          curve: Curves.elasticOut,
          duration: Duration(milliseconds: duration),
        );
  }
}

/// Animated Counter Widget with smooth number transition
class AnimatedCounter extends StatelessWidget {
  final String value;
  final TextStyle? style;
  final int duration;

  const AnimatedCounter({
    super.key,
    required this.value,
    this.style,
    this.duration = 600,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: duration),
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.scale(scale: 0.8 + (0.2 * value), child: child),
        );
      },
      child: Text(value, style: style),
    );
  }
}

/// Animated Progress Bar with gradient
class AnimatedProgressBar extends StatelessWidget {
  final double progress;
  final double height;
  final Color? backgroundColor;
  final Gradient? gradient;
  final int duration;
  final BorderRadius? borderRadius;

  const AnimatedProgressBar({
    super.key,
    required this.progress,
    this.height = 8,
    this.backgroundColor,
    this.gradient,
    this.duration = 800,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: backgroundColor ?? AppColors.border,
        borderRadius: borderRadius ?? BorderRadius.circular(height / 2),
      ),
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: progress.clamp(0.0, 1.0)),
        duration: Duration(milliseconds: duration),
        curve: Curves.easeOutCubic,
        builder: (context, value, child) {
          return FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: value,
            child: Container(
              decoration: BoxDecoration(
                gradient:
                    gradient ??
                    const LinearGradient(
                      colors: [AppColors.teal, AppColors.mint],
                    ),
                borderRadius: borderRadius ?? BorderRadius.circular(height / 2),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Pulsing Dot Indicator
class PulsingDot extends StatelessWidget {
  final Color color;
  final double size;

  const PulsingDot({super.key, this.color = AppColors.success, this.size = 8});

  @override
  Widget build(BuildContext context) {
    return Container(
          width: size,
          height: size,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        )
        .animate(onPlay: (controller) => controller.repeat())
        .scale(
          begin: const Offset(1, 1),
          end: const Offset(1.3, 1.3),
          duration: const Duration(milliseconds: 800),
        )
        .then()
        .scale(
          begin: const Offset(1.3, 1.3),
          end: const Offset(1, 1),
          duration: const Duration(milliseconds: 800),
        );
  }
}

/// Animated Icon Button with scale effect
class AnimatedIconButton extends StatefulWidget {
  final IconData icon;
  final VoidCallback? onTap;
  final Color? iconColor;
  final Color? backgroundColor;
  final double size;
  final double iconSize;
  final BorderRadius? borderRadius;
  final Border? border;

  const AnimatedIconButton({
    super.key,
    required this.icon,
    this.onTap,
    this.iconColor,
    this.backgroundColor,
    this.size = 44,
    this.iconSize = 22,
    this.borderRadius,
    this.border,
  });

  @override
  State<AnimatedIconButton> createState() => _AnimatedIconButtonState();
}

class _AnimatedIconButtonState extends State<AnimatedIconButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 150),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 0.9,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _controller.forward(),
      onTapUp: (_) {
        _controller.reverse();
        widget.onTap?.call();
      },
      onTapCancel: () => _controller.reverse(),
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _scaleAnimation.value,
            child: Container(
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(
                color: widget.backgroundColor ?? AppColors.cardBackground,
                borderRadius: widget.borderRadius ?? BorderRadius.circular(14),
                border: widget.border,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Icon(
                widget.icon,
                color: widget.iconColor ?? AppColors.textPrimary,
                size: widget.iconSize,
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Creative Section Header with animation
class AnimatedSectionHeader extends StatelessWidget {
  final String title;
  final String? badge;
  final Color? badgeColor;
  final Widget? trailing;
  final int delay;

  const AnimatedSectionHeader({
    super.key,
    required this.title,
    this.badge,
    this.badgeColor,
    this.trailing,
    this.delay = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
            letterSpacing: -0.5,
          ),
        ),
        if (badge != null) ...[
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: badgeColor ?? AppColors.secondary,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.primary, width: 1.5),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                PulsingDot(color: AppColors.primary, size: 6),
                const SizedBox(width: 6),
                Text(
                  badge!,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
        ],
        const Spacer(),
        if (trailing != null) trailing!,
      ],
    ).fadeSlideIn(delay: delay);
  }
}

/// Compact Mini Stat Card for Dashboard
class MiniStatCard extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;
  final VoidCallback? onTap;
  final int delay;

  const MiniStatCard({
    super.key,
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
    this.onTap,
    this.delay = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.2), width: 1.5),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      value,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: color,
                        letterSpacing: -0.5,
                      ),
                    ),
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              if (onTap != null)
                Icon(
                  Icons.chevron_right_rounded,
                  color: color.withValues(alpha: 0.5),
                  size: 20,
                ),
            ],
          ),
        ),
      ),
    ).fadeScaleIn(delay: delay);
  }
}

/// Compact Amount Card with gradient
class CompactAmountCard extends StatelessWidget {
  final String title;
  final String amount;
  final String? subtitle;
  final IconData icon;
  final List<Color> gradientColors;
  final VoidCallback? onTap;
  final int delay;

  const CompactAmountCard({
    super.key,
    required this.title,
    required this.amount,
    this.subtitle,
    required this.icon,
    required this.gradientColors,
    this.onTap,
    this.delay = 0,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: gradientColors,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.primary, width: 2),
          boxShadow: [
            BoxShadow(
              color: gradientColors[0].withValues(alpha: 0.3),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: Colors.white, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.9),
                    ),
                  ),
                  const SizedBox(height: 4),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      amount,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: Colors.white.withValues(alpha: 0.8),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.arrow_forward_ios_rounded,
                color: Colors.white,
                size: 14,
              ),
            ),
          ],
        ),
      ),
    ).fadeSlideIn(delay: delay);
  }
}

/// Creative Quick Action Button
class QuickActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;
  final int delay;

  const QuickActionChip({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    this.onTap,
    this.delay = 0,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.3), width: 1.5),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    ).fadeScaleIn(delay: delay);
  }
}

/// Floating Card with subtle shadow
class FloatingCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? backgroundColor;
  final BorderRadius? borderRadius;
  final Border? border;
  final int delay;

  const FloatingCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.backgroundColor,
    this.borderRadius,
    this.border,
    this.delay = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: backgroundColor ?? AppColors.cardBackground,
        borderRadius: borderRadius ?? BorderRadius.circular(20),
        border:
            border ??
            Border.all(
              color: AppColors.primary.withValues(alpha: 0.08),
              width: 1.5,
            ),
        boxShadow: [
          BoxShadow(
            color: AppColors.cardShadow.withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: child,
    ).fadeSlideIn(delay: delay);
  }
}

/// Staggered List Builder for animated lists
class StaggeredListBuilder extends StatelessWidget {
  final int itemCount;
  final Widget Function(BuildContext, int, int delay) itemBuilder;
  final int baseDelay;
  final int delayIncrement;

  const StaggeredListBuilder({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    this.baseDelay = 100,
    this.delayIncrement = 50,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        itemCount,
        (index) =>
            itemBuilder(context, index, baseDelay + (index * delayIncrement)),
      ),
    );
  }
}

/// Animated Badge/Chip
class AnimatedBadge extends StatelessWidget {
  final String text;
  final Color? color;
  final Color? textColor;
  final IconData? icon;
  final int delay;

  const AnimatedBadge({
    super.key,
    required this.text,
    this.color,
    this.textColor,
    this.icon,
    this.delay = 0,
  });

  @override
  Widget build(BuildContext context) {
    final bgColor = color ?? AppColors.secondary;
    final fgColor = textColor ?? AppColors.primary;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: fgColor.withValues(alpha: 0.3), width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, color: fgColor, size: 14),
            const SizedBox(width: 6),
          ],
          Text(
            text,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: fgColor,
            ),
          ),
        ],
      ),
    ).fadeScaleIn(delay: delay);
  }
}
