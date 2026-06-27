import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late AnimationController _pulseController;
  late AnimationController _shimmerController;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _pulseAnimation;
  late Animation<double> _shimmerAnimation;
  late Animation<double> _rotateAnimation;
  bool _hasNavigated = false;

  @override
  void initState() {
    super.initState();

    // Main animation controller
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );

    // Pulse animation for the logo glow
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );

    // Shimmer animation for loading effect
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.4, curve: Curves.easeOut),
      ),
    );

    _scaleAnimation = Tween<double>(begin: 0.3, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.5, curve: Curves.elasticOut),
      ),
    );

    _slideAnimation =
        Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero).animate(
          CurvedAnimation(
            parent: _controller,
            curve: const Interval(0.2, 0.6, curve: Curves.easeOutCubic),
          ),
        );

    _rotateAnimation = Tween<double>(begin: -0.1, end: 0.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.5, curve: Curves.easeOut),
      ),
    );

    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _shimmerAnimation = Tween<double>(begin: -1.0, end: 2.0).animate(
      CurvedAnimation(parent: _shimmerController, curve: Curves.easeInOut),
    );

    _controller.forward();
    _pulseController.repeat(reverse: true);
    _shimmerController.repeat();

    // Start minimum splash delay
    Future.delayed(const Duration(milliseconds: 2500), () {
      _checkAuthAndNavigate();
    });
  }

  void _checkAuthAndNavigate() {
    if (_hasNavigated || !mounted) return;

    final authState = ref.read(authStateProvider);

    // If not initialized yet, wait and check again
    if (!authState.isInitialized) {
      Future.delayed(const Duration(milliseconds: 200), () {
        _checkAuthAndNavigate();
      });
      return;
    }

    _hasNavigated = true;

    if (authState.isLoggedIn) {
      context.go('/dashboard');
    } else {
      context.go('/login');
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _pulseController.dispose();
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.primaryDark,
              AppColors.primary,
              AppColors.primary.withValues(alpha: 0.9),
            ],
            stops: const [0.0, 0.5, 1.0],
          ),
        ),
        child: Stack(
          children: [
            // Decorative background circles
            ..._buildBackgroundDecorations(size),

            // Main content - fully centered
            SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 40,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Logo Animation with glow effect
                        AnimatedBuilder(
                          animation: Listenable.merge([
                            _controller,
                            _pulseController,
                          ]),
                          builder: (context, child) {
                            return FadeTransition(
                              opacity: _fadeAnimation,
                              child: Transform.rotate(
                                angle: _rotateAnimation.value,
                                child: ScaleTransition(
                                  scale: _scaleAnimation,
                                  child: Transform.scale(
                                    scale: _pulseAnimation.value,
                                    child: child,
                                  ),
                                ),
                              ),
                            );
                          },
                          child: Container(
                            width: 120,
                            height: 120,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(40),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.white.withValues(alpha: 0.3),
                                  blurRadius: 40,
                                  spreadRadius: 5,
                                ),
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.2),
                                  blurRadius: 30,
                                  offset: const Offset(0, 15),
                                ),
                              ],
                            ),
                            child: Stack(
                              children: [
                                // Main logo content
                                Center(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      ShaderMask(
                                        shaderCallback: (bounds) =>
                                            LinearGradient(
                                              colors: [
                                                AppColors.primary,
                                                AppColors.primaryDark,
                                              ],
                                              begin: Alignment.topLeft,
                                              end: Alignment.bottomRight,
                                            ).createShader(bounds),
                                        child: const Icon(
                                          Icons.school_rounded,
                                          size: 65,
                                          color: Colors.white,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      ShaderMask(
                                        shaderCallback: (bounds) =>
                                            LinearGradient(
                                              colors: [
                                                AppColors.primary,
                                                AppColors.primaryDark,
                                              ],
                                              begin: Alignment.topLeft,
                                              end: Alignment.bottomRight,
                                            ).createShader(bounds),
                                        child: const Text(
                                          'CED',
                                          style: TextStyle(
                                            fontSize: 20,
                                            fontWeight: FontWeight.w800,
                                            color: Colors.white,
                                            letterSpacing: 3,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                // Shimmer effect overlay
                                AnimatedBuilder(
                                  animation: _shimmerController,
                                  builder: (context, child) {
                                    return ClipRRect(
                                      borderRadius: BorderRadius.circular(40),
                                      child: Container(
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            begin: Alignment(
                                              _shimmerAnimation.value - 1,
                                              0,
                                            ),
                                            end: Alignment(
                                              _shimmerAnimation.value,
                                              0,
                                            ),
                                            colors: [
                                              Colors.transparent,
                                              Colors.white.withValues(
                                                alpha: 0.15,
                                              ),
                                              Colors.transparent,
                                            ],
                                          ),
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 32),
                        // App Name Animation
                        SlideTransition(
                          position: _slideAnimation,
                          child: FadeTransition(
                            opacity: _fadeAnimation,
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                // App name with gradient effect
                                ShaderMask(
                                  shaderCallback: (bounds) =>
                                      const LinearGradient(
                                        colors: [
                                          Colors.white,
                                          Color(0xFFE3F2FD),
                                        ],
                                        begin: Alignment.topCenter,
                                        end: Alignment.bottomCenter,
                                      ).createShader(bounds),
                                  child: const Text(
                                    'ISKONNECT',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 36,
                                      fontWeight: FontWeight.w800,
                                      color: Colors.white,
                                      letterSpacing: 6,
                                      shadows: [
                                        Shadow(
                                          color: Colors.black26,
                                          offset: Offset(0, 4),
                                          blurRadius: 8,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 20,
                                    vertical: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: Colors.white.withValues(
                                        alpha: 0.2,
                                      ),
                                      width: 1,
                                    ),
                                  ),
                                  child: Text(
                                    'City Education Scholarship Program',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                      color: Colors.white.withValues(
                                        alpha: 0.95,
                                      ),
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 40),
                        // Loading Indicator with enhanced design
                        FadeTransition(
                          opacity: _fadeAnimation,
                          child: Column(
                            children: [
                              _buildLoadingIndicator(),
                              const SizedBox(height: 20),
                              AnimatedBuilder(
                                animation: _shimmerController,
                                builder: (context, child) {
                                  return ShaderMask(
                                    shaderCallback: (bounds) => LinearGradient(
                                      begin: Alignment(
                                        _shimmerAnimation.value - 1,
                                        0,
                                      ),
                                      end: Alignment(
                                        _shimmerAnimation.value,
                                        0,
                                      ),
                                      colors: [
                                        Colors.white.withValues(alpha: 0.5),
                                        Colors.white,
                                        Colors.white.withValues(alpha: 0.5),
                                      ],
                                    ).createShader(bounds),
                                    child: Text(
                                      'Loading your experience...',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                        color: Colors.white.withValues(
                                          alpha: 0.9,
                                        ),
                                        letterSpacing: 0.3,
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 40),
                        // Footer with enhanced design
                        FadeTransition(
                          opacity: _fadeAnimation,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.location_city_rounded,
                                    size: 16,
                                    color: Colors.white.withValues(alpha: 0.7),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    'City Government of Calapan',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w500,
                                      color: Colors.white.withValues(
                                        alpha: 0.85,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Oriental Mindoro, Philippines',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Colors.white.withValues(alpha: 0.6),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingIndicator() {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Outer ring
        SizedBox(
          width: 50,
          height: 50,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(
              Colors.white.withValues(alpha: 0.3),
            ),
          ),
        ),
        // Inner animated ring
        SizedBox(
          width: 38,
          height: 38,
          child: CircularProgressIndicator(
            strokeWidth: 3,
            strokeCap: StrokeCap.round,
            valueColor: AlwaysStoppedAnimation<Color>(
              Colors.white.withValues(alpha: 0.9),
            ),
          ),
        ),
        // Center dot
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.8),
            shape: BoxShape.circle,
          ),
        ),
      ],
    );
  }

  List<Widget> _buildBackgroundDecorations(Size size) {
    return [
      // Top left circle
      Positioned(
        top: -size.height * 0.15,
        left: -size.width * 0.2,
        child: AnimatedBuilder(
          animation: _pulseController,
          builder: (context, child) {
            return Transform.scale(
              scale: 0.9 + (_pulseAnimation.value - 1) * 0.5,
              child: Container(
                width: size.width * 0.6,
                height: size.width * 0.6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      Colors.white.withValues(alpha: 0.08),
                      Colors.white.withValues(alpha: 0.02),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
      // Bottom right circle
      Positioned(
        bottom: -size.height * 0.1,
        right: -size.width * 0.15,
        child: AnimatedBuilder(
          animation: _pulseController,
          builder: (context, child) {
            return Transform.scale(
              scale: 1.0 + (_pulseAnimation.value - 1) * 0.3,
              child: Container(
                width: size.width * 0.5,
                height: size.width * 0.5,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      Colors.white.withValues(alpha: 0.06),
                      Colors.white.withValues(alpha: 0.02),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
      // Center glow effect
      Positioned(
        top: size.height * 0.25,
        left: 0,
        right: 0,
        child: Container(
          height: size.height * 0.35,
          decoration: BoxDecoration(
            gradient: RadialGradient(
              colors: [
                Colors.white.withValues(alpha: 0.05),
                Colors.transparent,
              ],
            ),
          ),
        ),
      ),
      // Small floating particles
      ...List.generate(6, (index) {
        final random = math.Random(index);
        final left = random.nextDouble() * size.width;
        final top = random.nextDouble() * size.height;
        final particleSize = 4.0 + random.nextDouble() * 6;

        return Positioned(
          left: left,
          top: top,
          child: AnimatedBuilder(
            animation: _pulseController,
            builder: (context, child) {
              return Opacity(
                opacity: 0.2 + (_pulseAnimation.value - 1) * 2,
                child: Container(
                  width: particleSize,
                  height: particleSize,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                  ),
                ),
              );
            },
          ),
        );
      }),
    ];
  }
}
