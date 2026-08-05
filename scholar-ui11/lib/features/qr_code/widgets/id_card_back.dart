import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/qr_code/models/id_card_template_model.dart';

/// Near-black warm gray used for every dynamic text overlay on the back card
/// — matches the reference design's actual text color.
const _kIdCardTextColor = Color(0xFF242424);

/// Back of the templated scholar ID card: personal information, emergency
/// contact (with an inline "add" affordance if missing), the scholar's QR
/// code, and their typed name in a script font as a signature stand-in (this
/// app has no signature-capture feature). The "ADDRESS" / "DATE OF BIRTH" /
/// "IN CASE OF EMERGENCY, NOTIFY" labels are baked into the back background
/// artwork — only the values below each label are rendered dynamically here.
/// Coordinates are read directly off the reference PSD's layer bounding boxes
/// (canvas 1687x1063); the info column is center-aligned because every one
/// of its label/value boxes shares the same horizontal center (~68.8% of
/// card width) in the source design.
class IdCardBack extends ConsumerWidget {
  final IdCardTemplateModel template;

  const IdCardBack({super.key, required this.template});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final student = ref.watch(currentStudentProvider);
    if (student == null) return const SizedBox.shrink();

    return AspectRatio(
      aspectRatio: template.backAspectRatio,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final w = constraints.maxWidth;
          final h = constraints.maxHeight;
          // One pixel value used for both QR dimensions — see the QR block below.
          final qrSide = math.min(w * 0.30, h * 0.50);
          // Info column. Narrowed from 0.40/0.58 to buy the QR room on the
          // left, but kept symmetric about the same centre (0.69) so the values
          // stay aligned under the ADDRESS / DATE OF BIRTH labels printed on
          // the background, which are themselves centred at ~0.688.
          final colLeft = w * 0.46;
          final colWidth = w * 0.46;
          final hasEmergencyContact = (student.emergencyContactName?.isNotEmpty ?? false) &&
              (student.emergencyContactPhone?.isNotEmpty ?? false);

          return Stack(
            children: [
              Positioned.fill(
                child: template.backBackgroundUrl != null
                    ? Image.network(template.backBackgroundUrl!, fit: BoxFit.cover)
                    : Container(color: Colors.grey.shade200),
              ),
              // Address value (label baked into background above this box).
              Positioned(
                left: colLeft, top: h * 0.363, width: colWidth, height: h * 0.06,
                child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.center,
                    child: Text(student.idCardAddress, textAlign: TextAlign.center,
                        style: GoogleFonts.fredoka(fontWeight: FontWeight.w600, fontSize: 19, color: _kIdCardTextColor))),
              ),
              // Date of birth value (label baked into background above this box).
              Positioned(
                left: colLeft, top: h * 0.475, width: colWidth, height: h * 0.06,
                child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.center,
                    child: Text('${student.dateOfBirth.month}/${student.dateOfBirth.day}/${student.dateOfBirth.year}',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.fredoka(fontWeight: FontWeight.w600, fontSize: 19, color: _kIdCardTextColor))),
              ),
              // Emergency contact (name + phone, label baked into background
              // above this box) — or an inline "add" affordance if missing.
              Positioned(
                left: colLeft, top: h * 0.60, width: colWidth, height: h * 0.11,
                child: hasEmergencyContact
                    // Two Texts rather than one with a newline, so the name can
                    // outsize the phone number the way the reference design
                    // does (55.5pt vs 41.6pt on its canvas, a ~1.33x ratio).
                    // A single Text forced both to share one size.
                    ? FittedBox(
                        fit: BoxFit.scaleDown, alignment: Alignment.center,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(student.emergencyContactName!,
                                textAlign: TextAlign.center,
                                style: GoogleFonts.fredoka(
                                    fontWeight: FontWeight.w700, fontSize: 27, height: 1.1,
                                    color: _kIdCardTextColor)),
                            Text(student.emergencyContactPhone!,
                                textAlign: TextAlign.center,
                                style: GoogleFonts.fredoka(
                                    fontWeight: FontWeight.w600, fontSize: 20, height: 1.1,
                                    color: _kIdCardTextColor)),
                          ],
                        ),
                      )
                    : Center(
                        child: InkWell(
                          onTap: () => _showAddEmergencyContactDialog(context, ref),
                          child: Text('+ Add emergency contact',
                              style: GoogleFonts.fredoka(
                                  fontSize: 14, color: Colors.blue, decoration: TextDecoration.underline)),
                        ),
                      ),
              ),
              // Signature area, laid out for a card that gets printed and then
              // signed by hand: blank space to sign into, a rule to sign on,
              // the printed name, and the caption naming the convention.
              // Nothing here imitates a handwritten signature — an app-drawn
              // script name would be a fake attestation on an identity
              // document, and the scholar could never "sign" it themselves.
              //
              // x starts at 0.48 to clear the blue accent bar (which ends at
              // 0.478) and the block bottoms out at 0.90, just above the
              // bottom-right orange wedge, which intrudes to y 0.908 at x 0.92.
              Positioned(
                left: w * 0.48, top: h * 0.72, width: w * 0.44, height: h * 0.18,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Deliberately empty: this is where the scholar signs.
                    // A Spacer rather than a SizedBox so it absorbs whatever is
                    // left after the fixed rows below. Sizing it explicitly
                    // overflowed the column by a fraction of a pixel once the
                    // rule's fixed 1.2px was added to the height fractions.
                    const Spacer(),
                    Container(height: 1.2, color: _kIdCardTextColor),
                    SizedBox(height: h * 0.006),
                    SizedBox(
                      height: h * 0.045,
                      child: FittedBox(
                        fit: BoxFit.scaleDown, alignment: Alignment.topCenter,
                        child: Text(student.fullName.toUpperCase(),
                            textAlign: TextAlign.center,
                            style: GoogleFonts.barlowSemiCondensed(
                                fontWeight: FontWeight.w700, fontSize: 18,
                                letterSpacing: 0.6, color: _kIdCardTextColor)),
                      ),
                    ),
                    SizedBox(
                      height: h * 0.032,
                      child: FittedBox(
                        fit: BoxFit.scaleDown, alignment: Alignment.topCenter,
                        child: Text('SIGNATURE OVER PRINTED NAME',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.barlowSemiCondensed(
                                fontWeight: FontWeight.w600, fontSize: 11,
                                letterSpacing: 0.5, color: _kIdCardTextColor)),
                      ),
                    ),
                  ],
                ),
              ),
              // QR code — horizontally centred on the blue accent bar in the
              // background artwork, whose midpoint measures 0.2516 of the card
              // width (bar spans x 43-806 of the 1687px reference canvas). The
              // previous box was centred at 0.1677, noticeably left of it.
              //
              // Width 0.30 puts the right edge at 0.402, which is why the info
              // column was pulled back to 0.46 above — the two would otherwise
              // collide. Vertical space is now the real ceiling, not horizontal:
              // 0.30w is 0.48h at the default aspect, against a free band of
              // only ~0.546h between the diagonal header (which dips to ~0.285
              // over the QR's x-range) and the blue bar's top edge at 0.826.
              // It is centred in that band.
              //
              // Both dimensions are the same pixel value rather than a
              // width/height fraction pair, so the code stays genuinely square
              // for any backAspectRatio instead of only at the default 1.6.
              // The clamp keeps it inside the band on unusually wide artwork.
              Positioned(
                left: w * 0.2516 - qrSide / 2,
                top: h * 0.558 - qrSide / 2,
                width: qrSide,
                height: qrSide,
                child: QrImageView(
                  data: student.qrDisplayData,
                  backgroundColor: Colors.white,
                  padding: EdgeInsets.zero,
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showAddEmergencyContactDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (_) => _EmergencyContactDialog(
        onSave: (name, phone) {
          ref.read(authStateProvider.notifier).updateProfile(
                emergencyContactName: name,
                emergencyContactPhone: phone,
              );
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Emergency contact saved.')),
            );
          }
        },
      ),
    );
  }
}

/// Dialog content for "+ Add emergency contact" — a private [StatefulWidget]
/// so its two [TextEditingController]s get disposed when the dialog closes.
/// (The previous inline implementation created a fresh controller pair every
/// time the dialog opened but never disposed either, leaking one pair per
/// open.)
class _EmergencyContactDialog extends StatefulWidget {
  final void Function(String name, String phone) onSave;

  const _EmergencyContactDialog({required this.onSave});

  @override
  State<_EmergencyContactDialog> createState() => _EmergencyContactDialogState();
}

class _EmergencyContactDialogState extends State<_EmergencyContactDialog> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Emergency Contact'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(controller: _nameController, decoration: const InputDecoration(labelText: 'Name')),
          TextField(controller: _phoneController, decoration: const InputDecoration(labelText: 'Phone Number')),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        ElevatedButton(
          onPressed: () {
            widget.onSave(_nameController.text.trim(), _phoneController.text.trim());
            Navigator.pop(context);
          },
          child: const Text('Save'),
        ),
      ],
    );
  }
}
