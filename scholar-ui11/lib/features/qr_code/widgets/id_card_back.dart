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
                left: w * 0.40, top: h * 0.363, width: w * 0.58, height: h * 0.06,
                child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.center,
                    child: Text(student.fullAddress, textAlign: TextAlign.center,
                        style: GoogleFonts.fredoka(fontWeight: FontWeight.w600, fontSize: 19, color: _kIdCardTextColor))),
              ),
              // Date of birth value (label baked into background above this box).
              Positioned(
                left: w * 0.40, top: h * 0.475, width: w * 0.58, height: h * 0.06,
                child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.center,
                    child: Text('${student.dateOfBirth.month}/${student.dateOfBirth.day}/${student.dateOfBirth.year}',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.fredoka(fontWeight: FontWeight.w600, fontSize: 19, color: _kIdCardTextColor))),
              ),
              // Emergency contact (name + phone, label baked into background
              // above this box) — or an inline "add" affordance if missing.
              Positioned(
                left: w * 0.40, top: h * 0.60, width: w * 0.58, height: h * 0.10,
                child: hasEmergencyContact
                    ? FittedBox(
                        fit: BoxFit.scaleDown, alignment: Alignment.center,
                        child: Text('${student.emergencyContactName}\n${student.emergencyContactPhone}',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.fredoka(fontWeight: FontWeight.w600, fontSize: 20, color: _kIdCardTextColor)),
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
              // Scholar's own name, genuine cursive/script font, as a
              // signature stand-in (this app has no signature-capture
              // feature) — sits over the signature-line artwork baked into
              // the background.
              Positioned(
                left: w * 0.40, top: h * 0.841, width: w * 0.58, height: h * 0.06,
                child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.center,
                    child: Text(student.fullName, textAlign: TextAlign.center,
                        style: GoogleFonts.dancingScript(fontWeight: FontWeight.w700, fontSize: 30, color: _kIdCardTextColor))),
              ),
              // QR code — left region. Measured directly off this widget's
              // own rendered output: the previous box's bottom edge (0.8025)
              // was essentially touching the blue accent block's top edge
              // (0.804, measured from the actual downloaded card render), so
              // it's shrunk slightly to leave a real gap above the block.
              // Sized as a genuine square on the card's aspect ratio.
              Positioned(
                left: w * 0.0267, top: h * 0.3321, width: w * 0.282, height: h * 0.448,
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
