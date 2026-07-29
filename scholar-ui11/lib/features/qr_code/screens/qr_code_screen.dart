import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gal/gal.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:iskonnectttt/core/models/student_model.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/qr_code/providers/id_card_template_provider.dart';
import 'package:iskonnectttt/features/qr_code/widgets/id_card_back.dart';
import 'package:iskonnectttt/features/qr_code/widgets/id_card_front.dart';
import 'package:iskonnectttt/shared/utils/qr_download_stub.dart'
    if (dart.library.html) 'package:iskonnectttt/shared/utils/qr_download_web.dart';

class QRCodeScreen extends ConsumerStatefulWidget {
  const QRCodeScreen({super.key});

  @override
  ConsumerState<QRCodeScreen> createState() => _QRCodeScreenState();
}

class _QRCodeScreenState extends ConsumerState<QRCodeScreen> {
  // Captures the on-screen Scholarship ID card so we can export it as a PNG.
  final GlobalKey _idCardKey = GlobalKey();
  bool _downloading = false;

  /// Renders the Scholarship ID card widget to a high-resolution PNG and either
  /// triggers a browser download (web) or opens the share sheet to save it
  /// (mobile). This produces the full ID — photo, name, school, program, QR —
  /// not just the bare QR code.
  Future<void> _downloadIdCard(BuildContext context) async {
    if (_downloading) return;
    setState(() => _downloading = true);
    try {
      // Make sure the profile photo is decoded and painted before we capture,
      // otherwise the exported image has a blank photo slot.
      final student = ref.read(currentStudentProvider);
      final provider = profileImageProvider(student?.profilePicture);
      if (provider != null && context.mounted) {
        try {
          await precacheImage(provider, context)
              .timeout(const Duration(seconds: 6));
        } catch (_) {
          // Fall back to initials avatar if it can't be loaded.
        }
      }
      // Let the card (and the now-cached image) paint into the boundary.
      await WidgetsBinding.instance.endOfFrame;
      await WidgetsBinding.instance.endOfFrame;

      final boundary = _idCardKey.currentContext?.findRenderObject()
          as RenderRepaintBoundary?;
      if (boundary == null) {
        throw StateError('ID card not ready');
      }

      final image = await boundary.toImage(pixelRatio: 3.5);
      final byteData =
          await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) {
        throw StateError('Failed to encode image');
      }
      final bytes = byteData.buffer.asUint8List();

      if (kIsWeb) {
        downloadQrPng(bytes, 'scholarship_id.png');
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Scholarship ID download started.')),
          );
        }
        return;
      }

      // Save straight to the photo gallery so "Download" actually leaves a
      // file on the device, instead of only handing it to a share sheet.
      try {
        await Gal.putImageBytes(bytes, name: 'scholarship_id');
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Scholarship ID saved to your photo gallery.')),
          );
        }
      } catch (e) {
        debugPrint('Gal.putImageBytes failed, falling back to share: $e');
        await Share.shareXFiles(
          [
            XFile.fromData(
              bytes,
              mimeType: 'image/png',
              name: 'scholarship_id.png',
            ),
          ],
          text: 'My Scholarship ID',
          subject: 'Scholarship ID',
        );
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Couldn\'t save directly — share opened instead. Save the ID from there.'),
            ),
          );
        }
      }
    } catch (e) {
      debugPrint('ID card download failed: $e');
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to generate the ID image.')),
        );
      }
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final student = ref.watch(currentStudentProvider);

    if (student == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          child: Column(
            children: [
              // Modern Header
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _ModernBackButton(onTap: () => context.go('/dashboard')),
                  const SizedBox(width: 16),
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.primary,
                          AppColors.teal,
                          AppColors.mint,
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.4),
                          blurRadius: 12,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.qr_code_2_rounded,
                      color: Colors.white,
                      size: 30,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Scholar QR Code',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Your unique identification',
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),

              // Scholarship ID card — this exact widget is what gets exported
              // as the downloaded image (photo, name, school, program, QR).
              // Renders the admin-configured templated card (tap to flip
              // front/back) once a template is active, otherwise falls back
              // to the plain hardcoded card so the screen never breaks.
              Consumer(
                builder: (context, ref, _) {
                  final templateAsync = ref.watch(idCardTemplateProvider);
                  return templateAsync.when(
                    data: (template) {
                      if (template == null || template.frontBackgroundUrl == null) {
                        // No active template yet — fall back to the plain old card so the
                        // screen never breaks for a scholar before the admin sets one up.
                        return RepaintBoundary(key: _idCardKey, child: _ScholarshipIdCard(student: student));
                      }
                      return RepaintBoundary(
                        key: _idCardKey,
                        child: _FlippableIdCard(
                          front: IdCardFront(student: student, template: template),
                          back: IdCardBack(template: template),
                        ),
                      );
                    },
                    loading: () => const AspectRatio(aspectRatio: 1.6, child: Center(child: CircularProgressIndicator())),
                    error: (_, __) => RepaintBoundary(key: _idCardKey, child: _ScholarshipIdCard(student: student)),
                  );
                },
              ),
              const SizedBox(height: 16),

              // Download button (outside the RepaintBoundary so it isn't
              // captured into the exported image).
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _downloading
                      ? null
                      : () => _downloadIdCard(context),
                  icon: _downloading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.download_rounded),
                  label: Text(
                    _downloading ? 'Preparing…' : 'Download Scholarship ID',
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Modern Info Cards
              _ModernInfoCard(
                icon: Icons.account_balance_rounded,
                title: 'School',
                value: student.schoolName,
                color: AppColors.primary,
              ),
              const SizedBox(height: 12),
              _ModernInfoCard(
                icon: Icons.calendar_month_rounded,
                title: 'Academic Year',
                value: '${student.semester}, A.Y. ${student.academicYear}',
                color: AppColors.teal,
              ),
              const SizedBox(height: 12),
              _ModernInfoCard(
                icon: Icons.school_rounded,
                title: 'Program',
                value: student.academicProgram,
                color: AppColors.mint,
              ),
              const SizedBox(height: 24),

              // Modern Instructions Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppColors.teal.withValues(alpha: 0.08),
                      AppColors.primary.withValues(alpha: 0.04),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: AppColors.teal.withValues(alpha: 0.2),
                    width: 1,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: AppColors.teal.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            Icons.lightbulb_rounded,
                            color: AppColors.teal,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          'How to use your QR Code',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                            letterSpacing: -0.3,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _ModernInstructionItem(
                      number: '1',
                      text:
                          'Present this QR code when attending CED activities and events.',
                    ),
                    const SizedBox(height: 10),
                    _ModernInstructionItem(
                      number: '2',
                      text:
                          'The CED staff will scan your code to record your attendance.',
                    ),
                    const SizedBox(height: 10),
                    _ModernInstructionItem(
                      number: '3',
                      text:
                          'Ensure your screen brightness is sufficient for scanning.',
                    ),
                  ],
                ),
              ),

              if (student.isStAugustine) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        const Color(0xFFF59E0B).withValues(alpha: 0.1),
                        const Color(0xFFD97706).withValues(alpha: 0.05),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: const Color(0xFFF59E0B).withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(
                            0xFFF59E0B,
                          ).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.info_rounded,
                          color: Color(0xFFD97706),
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Note: As a St. Augustine Seminary student, you are exempt from attendance requirements.',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFFB45309),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
    );
  }
}

// Modern Back Button Widget
class _ModernBackButton extends StatelessWidget {
  final VoidCallback onTap;

  const _ModernBackButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: const Center(
            child: Icon(
              Icons.arrow_back_ios_new_rounded,
              size: 18,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}

// Modern Info Card Widget
class _ModernInfoCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;
  final Color color;

  const _ModernInfoCard({
    required this.icon,
    required this.title,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, size: 22, color: color),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textTertiary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// Modern Instruction Item Widget
class _ModernInstructionItem extends StatelessWidget {
  final String number;
  final String text;

  const _ModernInstructionItem({required this.number, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF06B6D4), Color(0xFF0891B2)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Center(
            child: Text(
              number,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}

/// Wraps [IdCardFront]/[IdCardBack] with a tap-triggered 3D Y-axis flip.
class _FlippableIdCard extends StatefulWidget {
  final Widget front;
  final Widget back;

  const _FlippableIdCard({required this.front, required this.back});

  @override
  State<_FlippableIdCard> createState() => _FlippableIdCardState();
}

class _FlippableIdCardState extends State<_FlippableIdCard> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 400),
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _flip() {
    if (_controller.isAnimating) return;
    if (_controller.value == 0) {
      _controller.forward();
    } else {
      _controller.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _flip,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final angle = _controller.value * 3.14159; // 0 to pi radians
          final showFront = angle <= 3.14159 / 2;
          final displayAngle = showFront ? angle : angle - 3.14159;
          return Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001) // perspective
              ..rotateY(displayAngle),
            child: showFront ? widget.front : widget.back,
          );
        },
      ),
    );
  }
}

// ── Scholarship ID card (the exported image) ───────────────────────────────

const Color _idNavy = Color(0xFF1E3A5F);
const Color _idNavyDark = Color(0xFF16294A);
const Color _idCardBg = Color(0xFFF4F6F9);
const Color _idGold = Color(0xFFEAB94E);
const Color _idTeal = Color(0xFF2D9596);

/// The downloadable Scholarship ID: header band, photo, name, school, program
/// and a "Scan to Verify" QR. Laid out landscape to match a physical ID card.
class _ScholarshipIdCard extends StatelessWidget {
  final StudentModel student;

  const _ScholarshipIdCard({required this.student});

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1.42,
      child: Container(
        decoration: BoxDecoration(
          color: _idCardBg,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _idNavy, width: 2),
          boxShadow: [
            BoxShadow(
              color: _idNavy.withValues(alpha: 0.28),
              blurRadius: 26,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            // Header band with diagonal accents + emblem
            Stack(
              children: [
                Positioned.fill(
                  child: Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [_idNavyDark, _idNavy, _idTeal],
                        stops: [0.0, 0.65, 1.5],
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                      ),
                    ),
                  ),
                ),
                Positioned.fill(
                  child: CustomPaint(painter: _HeaderAccentPainter()),
                ),
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'SCHOLARSHIP ID',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.6,
                          ),
                        ),
                      ),
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.25),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: ClipOval(
                          child: Image.asset(
                            'assets/images/calapan_seal.jpg',
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // Gold scholarship accent line
            Container(
              height: 4,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [_idGold, Color(0xFFF3D27E), _idGold],
                ),
              ),
            ),

            // Body
            Expanded(
              child: Stack(
                children: [
                  Positioned(
                    right: -14,
                    top: -10,
                    child: CustomPaint(
                      size: const Size(120, 120),
                      painter: _DotsPainter(_idNavy.withValues(alpha: 0.05)),
                    ),
                  ),
                  Positioned(
                    left: -16,
                    bottom: -16,
                    child: CustomPaint(
                      size: const Size(110, 110),
                      painter: _DotsPainter(_idTeal.withValues(alpha: 0.06)),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(13),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Photo with gradient ring
                        Expanded(
                          flex: 28,
                          child: AspectRatio(
                            aspectRatio: 0.82,
                            child: Container(
                              padding: const EdgeInsets.all(3),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(14),
                                gradient: const LinearGradient(
                                  colors: [_idNavy, _idTeal],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: _idNavy.withValues(alpha: 0.25),
                                    blurRadius: 8,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(11),
                                child: ProfileImage(student: student),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 13),

                        // Name + details
                        Expanded(
                          flex: 44,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  student.fullName.toUpperCase(),
                                  maxLines: 1,
                                  style: const TextStyle(
                                    color: _idNavy,
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 8),
                              _IdInfoRow(
                                icon: Icons.person,
                                label: 'NAME',
                                value: student.fullName,
                              ),
                              const SizedBox(height: 5),
                              _IdInfoRow(
                                icon: Icons.school,
                                label: 'SCHOOL',
                                value: student.schoolName,
                              ),
                              const SizedBox(height: 5),
                              _IdInfoRow(
                                icon: Icons.laptop_mac,
                                label: 'PROGRAM',
                                value: student.academicProgram,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 13),

                        // QR + Scan to verify
                        Expanded(
                          flex: 28,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              AspectRatio(
                                aspectRatio: 1,
                                child: Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: _idNavy.withValues(alpha: 0.15),
                                      width: 1.5,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: _idNavy.withValues(alpha: 0.12),
                                        blurRadius: 8,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: QrImageView(
                                    data: student.qrDisplayData,
                                    version: QrVersions.auto,
                                    backgroundColor: Colors.white,
                                    padding: EdgeInsets.zero,
                                    eyeStyle: const QrEyeStyle(
                                      eyeShape: QrEyeShape.square,
                                      color: _idNavy,
                                    ),
                                    dataModuleStyle: const QrDataModuleStyle(
                                      dataModuleShape: QrDataModuleShape.square,
                                      color: Color(0xFF1A1A1A),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 7),
                              Container(
                                width: double.infinity,
                                padding:
                                    const EdgeInsets.symmetric(vertical: 6),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [_idNavy, _idTeal],
                                  ),
                                  borderRadius: BorderRadius.circular(8),
                                  boxShadow: [
                                    BoxShadow(
                                      color: _idTeal.withValues(alpha: 0.3),
                                      blurRadius: 6,
                                      offset: const Offset(0, 3),
                                    ),
                                  ],
                                ),
                                child: const FittedBox(
                                  fit: BoxFit.scaleDown,
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.qr_code_scanner_rounded,
                                        color: Colors.white,
                                        size: 11,
                                      ),
                                      SizedBox(width: 4),
                                      Text(
                                        'SCAN TO VERIFY',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 9,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Bottom gold accent band (decorative, no text)
            Container(
              height: 5,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [_idGold, Color(0xFFF3D27E), _idGold],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A row of the ID card: navy circle icon + label + value.
class _IdInfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _IdInfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [_idNavy, _idTeal],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 13, color: Colors.white),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: _idNavy.withValues(alpha: 0.65),
                  fontSize: 8,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
              Text(
                value,
                maxLines: 2,
                softWrap: true,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFF1A1A1A),
                  fontSize: 10.5,
                  height: 1.15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Builds an [ImageProvider] for the scholar's profile picture, handling URLs,
/// `data:` URIs and raw base64. Returns null when there's nothing usable. The
/// same provider is precached before export so the photo is painted in time.
ImageProvider? profileImageProvider(String? raw) {
  if (raw == null || raw.trim().isEmpty) return null;
  try {
    final v = raw.trim();
    if (v.startsWith('http')) return NetworkImage(v);
    final b64 = v.startsWith('data:')
        ? v.substring(v.indexOf('base64,') + 'base64,'.length)
        : v;
    return MemoryImage(base64Decode(b64));
  } catch (_) {
    return null;
  }
}

/// Renders the scholar's profile photo. Shows a navy initials avatar while the
/// image loads or if it fails, so the photo slot is never blank.
class ProfileImage extends StatelessWidget {
  final StudentModel student;

  const ProfileImage({super.key, required this.student});

  @override
  Widget build(BuildContext context) {
    final provider = profileImageProvider(student.profilePicture);
    if (provider == null) return _fallback();

    return Image(
      image: provider,
      fit: BoxFit.cover,
      gaplessPlayback: true,
      frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
        if (wasSynchronouslyLoaded || frame != null) return child;
        return _fallback();
      },
      errorBuilder: (_, _, _) => _fallback(),
    );
  }

  Widget _fallback() {
    final initial =
        student.firstName.isNotEmpty ? student.firstName[0].toUpperCase() : '?';
    return Container(
      color: _idNavy,
      child: Center(
        child: Text(
          initial,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 40,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}

/// Translucent diagonal stripes that give the navy header some depth.
class _HeaderAccentPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final p1 = Paint()..color = Colors.white.withValues(alpha: 0.07);
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.62, 0)
        ..lineTo(w * 0.80, 0)
        ..lineTo(w * 0.52, h)
        ..lineTo(w * 0.34, h)
        ..close(),
      p1,
    );

    final p2 = Paint()..color = Colors.white.withValues(alpha: 0.05);
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.84, 0)
        ..lineTo(w * 1.02, 0)
        ..lineTo(w * 0.74, h)
        ..lineTo(w * 0.56, h)
        ..close(),
      p2,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// A grid of small dots used as a subtle background texture on the card body.
class _DotsPainter extends CustomPainter {
  final Color color;

  _DotsPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    const gap = 11.0;
    const radius = 1.4;
    for (double y = 0; y < size.height; y += gap) {
      for (double x = 0; x < size.width; x += gap) {
        canvas.drawCircle(Offset(x, y), radius, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DotsPainter oldDelegate) =>
      oldDelegate.color != color;
}
