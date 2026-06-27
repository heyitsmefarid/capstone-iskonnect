import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/features/announcements/providers/announcements_provider.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';

class MainShell extends ConsumerStatefulWidget {
  final Widget child;

  const MainShell({super.key, required this.child});

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  int _getCurrentIndexForScholar(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/dashboard')) return 0;
    if (location.startsWith('/profile')) return 1;
    if (location.startsWith('/qr-code')) return 2;
    if (location.startsWith('/announcements')) return 3;
    if (location.startsWith('/messaging')) return 4;
    return 0;
  }

  int _getCurrentIndexForApplicant(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/dashboard')) return 0;
    if (location.startsWith('/scholarship-application')) return 1;
    if (location.startsWith('/announcements')) return 2;
    if (location.startsWith('/profile')) return 3;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = ref.watch(unreadAnnouncementsCountProvider);
    final student = ref.watch(currentStudentProvider);
    final isScholar = student?.isScholar ?? false;
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      body: widget.child,
      bottomNavigationBar: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 650),
        curve: Curves.easeOutCubic,
        builder: (context, t, child) => Transform.translate(
          offset: Offset(0, 48 * (1 - t)),
          child: Opacity(opacity: t.clamp(0, 1), child: child),
        ),
        child: Container(
          margin: EdgeInsets.fromLTRB(16, 0, 16, bottomInset + 14),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(26),
            border: Border.all(
              color: AppColors.primary.withValues(alpha: 0.12),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.18),
                blurRadius: 28,
                spreadRadius: -6,
                offset: const Offset(0, 12),
              ),
              BoxShadow(
                color: AppColors.teal.withValues(alpha: 0.10),
                blurRadius: 18,
                offset: const Offset(0, -2),
              ),
            ],
          ),
          child: isScholar
              ? _buildScholarNavigation(context, unreadCount)
              : _buildApplicantNavigation(context, unreadCount),
        ),
      ),
    );
  }

  /// Navigation bar for SCHOLARS - full features
  Widget _buildScholarNavigation(BuildContext context, int unreadCount) {
    final currentIndex = _getCurrentIndexForScholar(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        _NavItem(
          icon: Icons.dashboard_outlined,
          activeIcon: Icons.dashboard_rounded,
          label: 'Home',
          isSelected: currentIndex == 0,
          onTap: () => context.go('/dashboard'),
          color: AppColors.teal,
        ),
        _NavItem(
          icon: Icons.person_outline_rounded,
          activeIcon: Icons.person_rounded,
          label: 'Profile',
          isSelected: currentIndex == 1,
          onTap: () => context.go('/profile'),
          color: AppColors.lavender,
        ),
        _CenterButton(
          icon: Icons.qr_code_outlined,
          activeIcon: Icons.qr_code_rounded,
          isSelected: currentIndex == 2,
          onTap: () => context.go('/qr-code'),
        ),
        _NavItem(
          icon: Icons.notifications_outlined,
          activeIcon: Icons.notifications_rounded,
          label: 'Alerts',
          isSelected: currentIndex == 3,
          onTap: () => context.go('/announcements'),
          badge: unreadCount > 0 ? unreadCount : null,
          color: AppColors.mustard,
        ),
        _NavItem(
          icon: Icons.chat_bubble_outline_rounded,
          activeIcon: Icons.chat_bubble_rounded,
          label: 'Chat',
          isSelected: currentIndex == 4,
          onTap: () => context.go('/messaging'),
          color: AppColors.coral,
        ),
      ],
    );
  }

  /// Navigation bar for APPLICANTS - limited features
  Widget _buildApplicantNavigation(BuildContext context, int unreadCount) {
    final currentIndex = _getCurrentIndexForApplicant(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        _NavItem(
          icon: Icons.dashboard_outlined,
          activeIcon: Icons.dashboard_rounded,
          label: 'Home',
          isSelected: currentIndex == 0,
          onTap: () => context.go('/dashboard'),
          color: AppColors.teal,
        ),
        _CenterButton(
          icon: Icons.school_outlined,
          activeIcon: Icons.school_rounded,
          isSelected: currentIndex == 1,
          onTap: () => context.go('/scholarship-application'),
        ),
        _NavItem(
          icon: Icons.notifications_outlined,
          activeIcon: Icons.notifications_rounded,
          label: 'Alerts',
          isSelected: currentIndex == 2,
          onTap: () => context.go('/announcements'),
          badge: unreadCount > 0 ? unreadCount : null,
          color: AppColors.mustard,
        ),
        _NavItem(
          icon: Icons.person_outline_rounded,
          activeIcon: Icons.person_rounded,
          label: 'Profile',
          isSelected: currentIndex == 3,
          onTap: () => context.go('/profile'),
          color: AppColors.lavender,
        ),
      ],
    );
  }
}

/// An expandable pill nav item: just an icon when idle, and a colored pill that
/// animates open to reveal its label when selected. Springs on tap.
class _NavItem extends StatefulWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;
  final int? badge;
  final Color color;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isSelected,
    required this.onTap,
    required this.color,
    this.badge,
  });

  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final c = widget.color;
    final selected = widget.isSelected;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap();
      },
      child: AnimatedScale(
        scale: _pressed ? 0.88 : 1,
        duration: const Duration(milliseconds: 130),
        curve: Curves.easeOut,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 340),
          curve: Curves.easeOutCubic,
          padding: EdgeInsets.symmetric(
            horizontal: selected ? 14 : 11,
            vertical: 10,
          ),
          decoration: BoxDecoration(
            color: selected ? c.withValues(alpha: 0.14) : Colors.transparent,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildIcon(selected, c),
              // Label slides open horizontally only when selected.
              ClipRect(
                child: AnimatedAlign(
                  duration: const Duration(milliseconds: 340),
                  curve: Curves.easeOutCubic,
                  alignment: Alignment.centerLeft,
                  widthFactor: selected ? 1 : 0,
                  // Without a heightFactor an Align expands to fill all
                  // available vertical space. Inside the bottomNavigationBar
                  // slot (offered the full screen height) that made the whole
                  // nav balloon to full-height and starved the body of space,
                  // so only the navbar was visible. Pin height to the child.
                  heightFactor: 1,
                  child: Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: Text(
                      widget.label,
                      style: TextStyle(
                        color: c,
                        fontWeight: FontWeight.w700,
                        fontSize: 12.5,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildIcon(bool selected, Color c) {
    final switcher = AnimatedSwitcher(
      duration: const Duration(milliseconds: 300),
      transitionBuilder: (child, anim) => ScaleTransition(
        scale: Tween<double>(begin: 0.6, end: 1).animate(anim),
        child: FadeTransition(opacity: anim, child: child),
      ),
      child: Icon(
        selected ? widget.activeIcon : widget.icon,
        key: ValueKey(selected),
        color: selected ? c : AppColors.textTertiary,
        size: 22,
      ),
    );

    if (widget.badge == null) return switcher;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        switcher,
        Positioned(
          right: -7,
          top: -6,
          child: Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: AppColors.coral,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.surface, width: 1.5),
            ),
            constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
            child: Text(
              widget.badge! > 9 ? '9+' : widget.badge.toString(),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 9,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ],
    );
  }
}

/// The raised center action — a gradient tile with a gentle, continuous glow
/// pulse and a spring on tap.
class _CenterButton extends StatefulWidget {
  final IconData icon;
  final IconData activeIcon;
  final bool isSelected;
  final VoidCallback onTap;

  const _CenterButton({
    required this.icon,
    required this.activeIcon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  State<_CenterButton> createState() => _CenterButtonState();
}

class _CenterButtonState extends State<_CenterButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap();
      },
      child: AnimatedScale(
        scale: _pressed ? 0.9 : 1,
        duration: const Duration(milliseconds: 130),
        curve: Curves.easeOut,
        child: AnimatedBuilder(
          animation: _pulse,
          builder: (context, child) {
            final t = _pulse.value; // 0..1
            return Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.teal, AppColors.primary],
                ),
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.teal.withValues(alpha: 0.35 + 0.25 * t),
                    blurRadius: 14 + 10 * t,
                    spreadRadius: 1 + 2 * t,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: child,
            );
          },
          child: Center(
            child: Icon(
              widget.isSelected ? widget.activeIcon : widget.icon,
              color: Colors.white,
              size: 26,
            ),
          ),
        ),
      ),
    );
  }
}
