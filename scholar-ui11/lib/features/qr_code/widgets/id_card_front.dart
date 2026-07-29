import 'package:flutter/material.dart';
import 'package:iskonnectttt/core/models/student_model.dart';
import 'package:iskonnectttt/features/qr_code/models/id_card_template_model.dart';
import 'package:iskonnectttt/features/qr_code/screens/qr_code_screen.dart' show ProfileImage;

/// Front of the templated scholar ID card: admin-configured background image
/// with the scholar's photo/name/school/program and the template's logo +
/// mayor's name/signature overlaid at fixed relative positions. Coordinates
/// below are approximate (read off the reference design by eye, not exact
/// PSD pixel values) — nudge them here if they drift from the reference
/// image during visual QA.
class IdCardFront extends StatelessWidget {
  final StudentModel student;
  final IdCardTemplateModel template;

  const IdCardFront({super.key, required this.student, required this.template});

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: template.frontAspectRatio,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final w = constraints.maxWidth;
          final h = constraints.maxHeight;
          return Stack(
            children: [
              Positioned.fill(
                child: template.frontBackgroundUrl != null
                    ? Image.network(template.frontBackgroundUrl!, fit: BoxFit.cover)
                    : Container(color: Colors.grey.shade300),
              ),
              // Primary logo — two circular seals, top-left header area.
              // Height kept short of the photo's top (h*0.18) so the two
              // don't overlap.
              if (template.primaryLogoUrl != null)
                Positioned(
                  left: w * 0.0, top: h * 0.0, width: w * 0.22, height: h * 0.16,
                  child: Image.network(template.primaryLogoUrl!, fit: BoxFit.contain),
                ),
              // Photo — left third of the card. Reuses the existing
              // photo-with-fallback-initials-avatar widget (Step 1). Height
              // trimmed to h*0.68 (was h*0.74) so it stops short of the
              // secondary logo below (top: h*0.88) instead of overlapping it.
              Positioned(
                left: w * 0.03, top: h * 0.18, width: w * 0.30, height: h * 0.68,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(w * 0.02),
                  child: ProfileImage(student: student),
                ),
              ),
              // Name.
              Positioned(
                left: w * 0.38, top: h * 0.33, width: w * 0.58, height: h * 0.19,
                child: FittedBox(
                  fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
                  child: Text(student.fullName.toUpperCase(),
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22, color: Color(0xFF1E3A5F))),
                ),
              ),
              // School + program.
              Positioned(
                left: w * 0.38, top: h * 0.52, width: w * 0.58, height: h * 0.16,
                child: FittedBox(
                  fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
                  child: Text('${student.schoolName}\n${student.academicProgram}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87)),
                ),
              ),
              // Secondary logo (bottom-left).
              if (template.secondaryLogoUrl != null)
                Positioned(
                  left: w * 0.02, top: h * 0.88, width: w * 0.30, height: h * 0.12,
                  child: Image.network(template.secondaryLogoUrl!, fit: BoxFit.contain),
                ),
              // Mayor's signature + name (bottom-right).
              Positioned(
                left: w * 0.68, top: h * 0.82, width: w * 0.30, height: h * 0.18,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (template.mayorSignatureUrl != null)
                      Expanded(child: Image.network(template.mayorSignatureUrl!, fit: BoxFit.contain)),
                    if (template.mayorName != null)
                      FittedBox(fit: BoxFit.scaleDown, child: Text(template.mayorName!,
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold))),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
