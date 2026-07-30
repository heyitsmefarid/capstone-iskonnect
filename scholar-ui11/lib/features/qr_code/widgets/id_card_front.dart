import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:iskonnectttt/core/models/student_model.dart';
import 'package:iskonnectttt/features/qr_code/models/id_card_template_model.dart';
import 'package:iskonnectttt/features/qr_code/screens/qr_code_screen.dart' show ProfileImage;

/// Two-tone name colors and the school/program dark gray, sampled directly
/// from the flattened reference design's pixels (not guessed from PSD
/// metadata, which reported the same color for both name lines despite them
/// rendering in visibly different shades of blue).
const _kNameFirstColor = Color(0xFF14429A); // first name — navy.
const _kNameLastColor = Color(0xFF5A88E0); // middle initial + surname — light blue.
const _kSchoolTextColor = Color(0xFF242424); // near-black.

/// The card's signature diagonal slant, measured off the reference render by
/// tracking the "CITY SCHOLAR" ribbon's top edge across the card width
/// (it drops 145px over 960px => 8.6°). The name and school/program blocks
/// sit parallel to that ribbon. Negative because Flutter's rotation angle is
/// clockwise-positive in this y-down coordinate system, so a negative angle
/// lifts the right side.
const _kSlantDeg = 8.6;
const _kTextSlant = -_kSlantDeg * math.pi / 180;

/// Front of the templated scholar ID card: admin-configured background image
/// (which already includes the Calapan City + City Education Department
/// seals, the "BRIDGING FUTURES SCHOLARSHIP PROGRAM" banner, and the "CITY
/// SCHOLAR" ribbon baked in) with the scholar's photo/name/school/program and
/// the mayor's logo/signature overlaid at fixed relative positions.
///
/// Coordinates were measured directly off the flattened reference design's
/// pixels (a composited render of the source PSD, canvas 1687x1063) rather
/// than taken from PSD layer bounding boxes, which reported padding/slack
/// that doesn't match what's actually visible.
///
/// Layout note: each slanted block puts [Transform.rotate] *outside* a
/// [FittedBox], not inside. Inside, the FittedBox would measure the child's
/// pre-rotation size and have no idea the painted result is larger, so the
/// content silently bled into its neighbours (this is what pushed the
/// school/program line into the ribbon). Outside, the FittedBox fills its
/// box exactly and the rotation grows the footprint by a computable amount,
/// so the boxes below are pre-shrunk to absorb that growth.
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
          final middleInitial =
              student.middleName.isNotEmpty ? '${student.middleName[0].toUpperCase()}. ' : '';
          return Stack(
            children: [
              Positioned.fill(
                child: template.frontBackgroundUrl != null
                    ? Image.network(template.frontBackgroundUrl!, fit: BoxFit.cover)
                    : Container(color: Colors.grey.shade300),
              ),
              // Photo — a true circle (measured from the reference render).
              Positioned(
                left: w * 0.0617, top: h * 0.3039, width: w * 0.2721, height: h * 0.4478,
                child: ClipOval(child: ProfileImage(student: student)),
              ),
              // Name — two lines, two tones: first name in navy, middle
              // initial + surname in light blue. BoxFit.contain (not
              // scaleDown) so the name actually fills its region the way the
              // reference does; scaleDown left short names rendering at their
              // tiny natural point size in a box many times larger.
              Positioned(
                left: w * 0.41, top: h * 0.36, width: w * 0.50, height: h * 0.17,
                child: Transform.rotate(
                  angle: _kTextSlant,
                  child: FittedBox(
                    fit: BoxFit.contain,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(student.firstName.toUpperCase(),
                            textAlign: TextAlign.center,
                            style: GoogleFonts.fredoka(
                                fontWeight: FontWeight.w700, height: 1.0, color: _kNameFirstColor)),
                        Text('$middleInitial${student.lastName.toUpperCase()}',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.fredoka(
                                fontWeight: FontWeight.w700, height: 1.0, color: _kNameLastColor)),
                      ],
                    ),
                  ),
                ),
              ),
              // School + program — sits in the band between the name and the
              // "CITY SCHOLAR" ribbon. The ribbon's top edge runs from
              // y=0.754 at x=0.379 to y=0.618 at x=0.948; this box's centre
              // is placed so the rotated block's bottom edge stays parallel
              // to that line with a consistent gap.
              Positioned(
                left: w * 0.405, top: h * 0.556, width: w * 0.52, height: h * 0.11,
                child: Transform.rotate(
                  angle: _kTextSlant,
                  child: FittedBox(
                    fit: BoxFit.contain,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(student.schoolName.toUpperCase(),
                            textAlign: TextAlign.center,
                            style: GoogleFonts.fredoka(
                                fontWeight: FontWeight.w500, height: 1.15, color: _kSchoolTextColor)),
                        Text(student.academicProgram.toUpperCase(),
                            textAlign: TextAlign.center,
                            style: GoogleFonts.fredoka(
                                fontWeight: FontWeight.w600, height: 1.15, color: _kSchoolTextColor)),
                      ],
                    ),
                  ),
                ),
              ),
              // Mayor's own logo (administration/campaign logo), bottom-left.
              if (template.mayorLogoUrl != null)
                Positioned(
                  left: w * 0.0379, top: h * 0.8129, width: w * 0.2738, height: h * 0.1355,
                  child: Image.network(template.mayorLogoUrl!, fit: BoxFit.contain),
                ),
              // Mayor's signature (bottom-right) — the printed name is baked
              // into this same image, on top of the signature; no separate
              // text overlay.
              if (template.mayorSignatureUrl != null)
                Positioned(
                  left: w * 0.7368, top: h * 0.847, width: w * 0.2306, height: h * 0.1524,
                  child: Image.network(template.mayorSignatureUrl!, fit: BoxFit.contain),
                ),
            ],
          );
        },
      ),
    );
  }
}
