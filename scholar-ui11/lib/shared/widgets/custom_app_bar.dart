import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';

class CustomAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final bool showBackButton;
  final VoidCallback? onBackPressed;
  final Widget? leading;
  final Color? backgroundColor;
  final bool centerTitle;
  final double elevation;
  final PreferredSizeWidget? bottom;

  const CustomAppBar({
    super.key,
    required this.title,
    this.actions,
    this.showBackButton = true,
    this.onBackPressed,
    this.leading,
    this.backgroundColor,
    this.centerTitle = true,
    this.elevation = 0,
    this.bottom,
  });

  @override
  Size get preferredSize =>
      Size.fromHeight(kToolbarHeight + (bottom?.preferredSize.height ?? 0));

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text(
        title,
        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
      ),
      centerTitle: centerTitle,
      backgroundColor: backgroundColor ?? AppColors.surface,
      elevation: elevation,
      scrolledUnderElevation: 1,
      leading:
          leading ??
          (showBackButton
              ? IconButton(
                  icon: const Icon(Icons.arrow_back_ios, size: 20),
                  onPressed: onBackPressed ?? () => context.go('/dashboard'),
                )
              : null),
      actions: actions,
      bottom: bottom,
    );
  }
}

class SliverAppBarWidget extends StatelessWidget {
  final String title;
  final List<Widget>? actions;
  final Widget? flexibleSpace;
  final double expandedHeight;
  final bool pinned;
  final bool floating;

  const SliverAppBarWidget({
    super.key,
    required this.title,
    this.actions,
    this.flexibleSpace,
    this.expandedHeight = 200,
    this.pinned = true,
    this.floating = false,
  });

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      expandedHeight: expandedHeight,
      pinned: pinned,
      floating: floating,
      backgroundColor: AppColors.surface,
      elevation: 0,
      title: Text(
        title,
        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
      ),
      actions: actions,
      flexibleSpace: flexibleSpace,
    );
  }
}
