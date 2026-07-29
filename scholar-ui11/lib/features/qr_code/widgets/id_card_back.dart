import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/qr_code/models/id_card_template_model.dart';

/// Back of the templated scholar ID card: personal information, emergency
/// contact (with an inline "add" affordance if missing), the scholar's QR
/// code, and their typed name in a script font as a signature stand-in (this
/// app has no signature-capture feature).
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
              // Address.
              Positioned(
                left: w * 0.45, top: h * 0.33, width: w * 0.53, height: h * 0.09,
                child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
                    child: Text(student.fullAddress, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
              ),
              // Date of birth.
              Positioned(
                left: w * 0.45, top: h * 0.43, width: w * 0.53, height: h * 0.09,
                child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
                    child: Text('${student.dateOfBirth.month}/${student.dateOfBirth.day}/${student.dateOfBirth.year}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
              ),
              // Emergency contact — or an inline "add" affordance if missing.
              Positioned(
                left: w * 0.45, top: h * 0.53, width: w * 0.53, height: h * 0.17,
                child: hasEmergencyContact
                    ? FittedBox(
                        fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
                        child: Text('${student.emergencyContactName}\n${student.emergencyContactPhone}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                      )
                    : InkWell(
                        onTap: () => _showAddEmergencyContactDialog(context, ref),
                        child: const Text('+ Add emergency contact',
                            style: TextStyle(fontSize: 11, color: Colors.blue, decoration: TextDecoration.underline)),
                      ),
              ),
              // Scholar's own name, script font, as a signature stand-in.
              Positioned(
                left: w * 0.45, top: h * 0.74, width: w * 0.53, height: h * 0.18,
                child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.bottomLeft,
                    child: Text(student.fullName, style: const TextStyle(fontStyle: FontStyle.italic, fontSize: 16))),
              ),
              // QR code — bottom-left region (x 0-45%), sized as a genuinely
              // square, scannable box rather than the reference design's
              // literal (too-small) placeholder slot. `width`/`height` below
              // are chosen so the box comes out square in actual pixels for
              // the default 1.6 aspect ratio (height-fraction = 1.6 *
              // width-fraction), comfortably clear of the right-side content
              // that starts at x 45%.
              Positioned(
                left: w * 0.03, top: h * 0.32, width: w * 0.40, height: h * 0.64,
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
