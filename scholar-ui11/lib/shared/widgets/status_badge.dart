import 'package:flutter/material.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final double fontSize;
  final EdgeInsetsGeometry? padding;

  const StatusBadge({
    super.key,
    required this.status,
    this.fontSize = 13,
    this.padding,
  });

  Color get _backgroundColor {
    switch (status.toLowerCase()) {
      case 'active':
      case 'verified':
      case 'present':
      case 'passed':
      case 'approved':
        return AppColors.teal;
      case 'for evaluation':
      case 'pending':
      case 'submitted':
        return AppColors.mustard;
      case 'terminated':
      case 'rejected':
      case 'absent':
      case 'failed':
        return AppColors.coral;
      case 'extended':
        return AppColors.lavender;
      default:
        return AppColors.textSecondary;
    }
  }

  Color get _textColor {
    return Colors.white;
  }

  Color get _borderColor {
    switch (status.toLowerCase()) {
      case 'active':
      case 'verified':
      case 'present':
      case 'passed':
      case 'approved':
        return AppColors.primary;
      case 'for evaluation':
      case 'pending':
      case 'submitted':
        return AppColors.primary;
      case 'terminated':
      case 'rejected':
      case 'absent':
      case 'failed':
        return AppColors.primary;
      case 'extended':
        return AppColors.primary;
      default:
        return AppColors.primary;
    }
  }

  IconData? get _icon {
    switch (status.toLowerCase()) {
      case 'active':
      case 'verified':
      case 'present':
      case 'passed':
      case 'approved':
        return Icons.check_circle_rounded;
      case 'for evaluation':
      case 'pending':
      case 'submitted':
        return Icons.schedule_rounded;
      case 'terminated':
      case 'rejected':
      case 'absent':
      case 'failed':
        return Icons.cancel_rounded;
      case 'extended':
        return Icons.add_circle_rounded;
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          padding ?? const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: _backgroundColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: _borderColor, width: 2),
        boxShadow: [
          BoxShadow(
            color: _backgroundColor.withValues(alpha: 0.3),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_icon != null) ...[
            Icon(_icon, size: fontSize + 3, color: _textColor),
            const SizedBox(width: 6),
          ],
          Text(
            status,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              color: _textColor,
              letterSpacing: -0.2,
            ),
          ),
        ],
      ),
    );
  }
}

class IconStatusBadge extends StatelessWidget {
  final IconData icon;
  final Color color;
  final double size;

  const IconStatusBadge({
    super.key,
    required this.icon,
    required this.color,
    this.size = 44,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.3), width: 2),
      ),
      child: Icon(icon, color: color, size: size * 0.5),
    );
  }
}
