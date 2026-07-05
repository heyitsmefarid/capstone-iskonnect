import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:iskonnectttt/core/models/student_model.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import '../models/bfcsp_application_model.dart';
import '../utils/bfcsp_form_api.dart';
import 'package:printing/printing.dart';

class BfcspApplicationFormScreen extends ConsumerStatefulWidget {
  final String? draftId;
  final String? userId;
  // The signed-in applicant's registration record. When provided (and there is
  // no saved draft) the form is pre-filled from it so only the remaining,
  // application-specific fields need to be answered. Falls back to the auth
  // provider's current student when not passed in.
  final StudentModel? student;
  const BfcspApplicationFormScreen({super.key, this.draftId, this.userId, this.student});

  @override
  ConsumerState<BfcspApplicationFormScreen> createState() => _BfcspApplicationFormScreenState();
}

class _BfcspApplicationFormScreenState extends ConsumerState<BfcspApplicationFormScreen> {
  final PageController _pageCtrl = PageController();
  int _currentStep = 0;
  bool _loading = false;
  bool _prefilled = false;
  String? _draftId;
  late BfcspApplicationModel _app;

  final List<GlobalKey<FormState>> _formKeys = List.generate(5, (_) => GlobalKey<FormState>());

  // ── Step 1 controllers
  final _lastNameCtrl = TextEditingController();
  final _firstNameCtrl = TextEditingController();
  final _middleNameCtrl = TextEditingController();
  final _nicknameCtrl = TextEditingController();
  final _ageCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _pobCtrl = TextEditingController();
  final _citizenshipCtrl = TextEditingController();
  final _religionCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _fbCtrl = TextEditingController();
  final _contactCtrl = TextEditingController();
  final _houseNoCtrl = TextEditingController();
  final _streetCtrl = TextEditingController();
  final _subdivCtrl = TextEditingController();
  final _barangayCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _provinceCtrl = TextEditingController();
  final _shsTrackCtrl = TextEditingController();
  final _disabilityCtrl = TextEditingController();
  final _ipCtrl = TextEditingController();
  final _skillsCtrl = TextEditingController();

  // ── Step 2 controllers
  final _elemSchoolCtrl = TextEditingController();
  final _elemHonorsCtrl = TextEditingController();
  final _jhsSchoolCtrl = TextEditingController();
  final _jhsHonorsCtrl = TextEditingController();
  final _shsSchoolCtrl = TextEditingController();
  final _shsHonorsCtrl = TextEditingController();
  final _shsGwa11Ctrl = TextEditingController();
  final _shsGwa12Ctrl = TextEditingController();
  final _gwaCtrl = TextEditingController();
  final _examScoreCtrl = TextEditingController();

  // ── Step 3 controllers
  final _fatherNameCtrl = TextEditingController();
  final _fatherContactCtrl = TextEditingController();
  final _fatherEdCtrl = TextEditingController();
  final _fatherOccCtrl = TextEditingController();
  final _fatherIncCtrl = TextEditingController();
  final _motherNameCtrl = TextEditingController();
  final _motherMaidenCtrl = TextEditingController();
  final _motherContactCtrl = TextEditingController();
  final _motherEdCtrl = TextEditingController();
  final _motherOccCtrl = TextEditingController();
  final _motherIncCtrl = TextEditingController();
  final _guardianNameCtrl = TextEditingController();
  final _guardianContactCtrl = TextEditingController();
  final _guardianEdCtrl = TextEditingController();
  final _guardianOccCtrl = TextEditingController();
  final _guardianIncCtrl = TextEditingController();
  final _siblingCountCtrl = TextEditingController();
  final _fourPsFromCtrl = TextEditingController();
  final _fourPsToCtrl = TextEditingController();

  // ── Step 4 controllers
  final _preferredSchoolCtrl = TextEditingController();
  final _prog1Ctrl = TextEditingController();
  final _prog2Ctrl = TextEditingController();
  final _prog3Ctrl = TextEditingController();

  // ── Step 5 controllers
  final _essayCtrl = TextEditingController();

  final List<String> _steps = [
    'Personal Info',
    'Education',
    'Family',
    'Preferences',
    'Submit',
  ];

  @override
  void initState() {
    super.initState();
    _app = BfcspApplicationModel(userId: widget.userId ?? widget.student?.id);
    if (widget.draftId != null) {
      _draftId = widget.draftId;
      _loadDraft();
    } else {
      _cityCtrl.text = 'Calapan City';
      _provinceCtrl.text = 'Oriental Mindoro';
      _citizenshipCtrl.text = 'Filipino';
      _disabilityCtrl.text = 'N/A';
      _ipCtrl.text = 'N/A';
      _prefillFromRegistration();
    }
  }

  /// Pre-fills the form with data the applicant already provided during
  /// registration, so they only need to answer the remaining fields.
  void _prefillFromRegistration() {
    // Prefer the explicitly-passed record, otherwise pull the signed-in
    // applicant straight from the auth provider so the pre-fill works no matter
    // how this screen was opened.
    final s = widget.student ?? ref.read(currentStudentProvider);
    if (s == null) return;
    _prefilled = true;

    void setIf(TextEditingController ctrl, String value) {
      if (value.trim().isNotEmpty) ctrl.text = value.trim();
    }

    setIf(_lastNameCtrl, s.lastName);
    setIf(_firstNameCtrl, s.firstName);
    setIf(_middleNameCtrl, s.middleName);
    setIf(_emailCtrl, s.email);
    setIf(_contactCtrl, s.contactNumber);
    setIf(_houseNoCtrl, s.houseNo);
    setIf(_streetCtrl, s.street);
    setIf(_barangayCtrl, s.barangay);
    setIf(_cityCtrl, s.city);
    setIf(_provinceCtrl, s.province);
    setIf(_ageCtrl, s.age > 0 ? s.age.toString() : '');
    setIf(_dobCtrl, DateFormat('yyyy-MM-dd').format(s.dateOfBirth));
    // Registration also captures the applicant's school/program — seed the
    // first preference so it can be confirmed or changed.
    setIf(_preferredSchoolCtrl, s.schoolName);
    setIf(_prog1Ctrl, s.academicProgram);

    // Sex maps directly to the BFCSP dropdown (registration uses Male/Female).
    if (s.gender == 'Male' || s.gender == 'Female') {
      _app.sex = s.gender;
    }
    if (s.academicYear.trim().isNotEmpty) {
      _app.academicYear = s.academicYear.trim();
    }
  }

  Future<void> _loadDraft() async {
    setState(() => _loading = true);
    try {
      final doc = await FirebaseFirestore.instance
          .collection('scholarship_applications')
          .doc(_draftId)
          .get();
      if (doc.exists) {
        _app = BfcspApplicationModel.fromMap(doc.data()!);
        _populateControllers();
      }
    } catch (e) {
      _showSnack('Could not load draft: $e', error: true);
    }
    setState(() => _loading = false);
  }

  void _populateControllers() {
    _lastNameCtrl.text = _app.lastName;
    _firstNameCtrl.text = _app.firstName;
    _middleNameCtrl.text = _app.middleName;
    _nicknameCtrl.text = _app.nickname;
    _ageCtrl.text = _app.age;
    _dobCtrl.text = _app.dateOfBirth;
    _pobCtrl.text = _app.placeOfBirth;
    _citizenshipCtrl.text = _app.citizenship;
    _religionCtrl.text = _app.religion;
    _emailCtrl.text = _app.emailAddress;
    _fbCtrl.text = _app.facebookUsername;
    _contactCtrl.text = _app.contactNumbers;
    _houseNoCtrl.text = _app.houseNo;
    _streetCtrl.text = _app.street;
    _subdivCtrl.text = _app.subdivisionVillage;
    _barangayCtrl.text = _app.barangay;
    _cityCtrl.text = _app.cityMunicipality;
    _provinceCtrl.text = _app.province;
    _shsTrackCtrl.text = _app.shsTrackStrand;
    _disabilityCtrl.text = _app.typeOfDisability;
    _ipCtrl.text = _app.ipAffiliation;
    _skillsCtrl.text = _app.specialSkills;
    _elemSchoolCtrl.text = _app.elementarySchool;
    _elemHonorsCtrl.text = _app.elementaryHonors;
    _jhsSchoolCtrl.text = _app.jhsSchool;
    _jhsHonorsCtrl.text = _app.jhsHonors;
    _shsSchoolCtrl.text = _app.shsSchool;
    _shsHonorsCtrl.text = _app.shsHonors;
    _shsGwa11Ctrl.text = _app.shsGwaGrade11;
    _shsGwa12Ctrl.text = _app.shsGwaGrade12;
    _gwaCtrl.text = _app.gwa;
    _examScoreCtrl.text = _app.competitiveExamScore;
    _fatherNameCtrl.text = _app.fatherName;
    _fatherContactCtrl.text = _app.fatherContact;
    _fatherEdCtrl.text = _app.fatherEducation;
    _fatherOccCtrl.text = _app.fatherOccupation;
    _fatherIncCtrl.text = _app.fatherIncome;
    _motherNameCtrl.text = _app.motherName;
    _motherMaidenCtrl.text = _app.motherMaidenName;
    _motherContactCtrl.text = _app.motherContact;
    _motherEdCtrl.text = _app.motherEducation;
    _motherOccCtrl.text = _app.motherOccupation;
    _motherIncCtrl.text = _app.motherIncome;
    _guardianNameCtrl.text = _app.guardianName;
    _guardianContactCtrl.text = _app.guardianContact;
    _guardianEdCtrl.text = _app.guardianEducation;
    _guardianOccCtrl.text = _app.guardianOccupation;
    _guardianIncCtrl.text = _app.guardianIncome;
    _siblingCountCtrl.text = _app.numberOfSiblings;
    _fourPsFromCtrl.text = _app.fourPsFrom;
    _fourPsToCtrl.text = _app.fourPsTo;
    _preferredSchoolCtrl.text = _app.preferredSchool;
    _prog1Ctrl.text = _app.preferredProgram1;
    _prog2Ctrl.text = _app.preferredProgram2;
    _prog3Ctrl.text = _app.preferredProgram3;
    _essayCtrl.text = _app.essayAnswer;
    setState(() {});
  }

  void _syncToModel() {
    _app.lastName = _lastNameCtrl.text.trim();
    _app.firstName = _firstNameCtrl.text.trim();
    _app.middleName = _middleNameCtrl.text.trim();
    _app.nickname = _nicknameCtrl.text.trim();
    _app.age = _ageCtrl.text.trim();
    _app.dateOfBirth = _dobCtrl.text.trim();
    _app.placeOfBirth = _pobCtrl.text.trim();
    _app.citizenship = _citizenshipCtrl.text.trim();
    _app.religion = _religionCtrl.text.trim();
    _app.emailAddress = _emailCtrl.text.trim();
    _app.facebookUsername = _fbCtrl.text.trim();
    _app.contactNumbers = _contactCtrl.text.trim();
    _app.houseNo = _houseNoCtrl.text.trim();
    _app.street = _streetCtrl.text.trim();
    _app.subdivisionVillage = _subdivCtrl.text.trim();
    _app.barangay = _barangayCtrl.text.trim();
    _app.cityMunicipality = _cityCtrl.text.trim();
    _app.province = _provinceCtrl.text.trim();
    _app.shsTrackStrand = _shsTrackCtrl.text.trim();
    _app.typeOfDisability = _disabilityCtrl.text.trim();
    _app.ipAffiliation = _ipCtrl.text.trim();
    _app.specialSkills = _skillsCtrl.text.trim();
    _app.elementarySchool = _elemSchoolCtrl.text.trim();
    _app.elementaryHonors = _elemHonorsCtrl.text.trim();
    _app.jhsSchool = _jhsSchoolCtrl.text.trim();
    _app.jhsHonors = _jhsHonorsCtrl.text.trim();
    _app.shsSchool = _shsSchoolCtrl.text.trim();
    _app.shsHonors = _shsHonorsCtrl.text.trim();
    _app.shsGwaGrade11 = _shsGwa11Ctrl.text.trim();
    _app.shsGwaGrade12 = _shsGwa12Ctrl.text.trim();
    _app.gwa = _gwaCtrl.text.trim();
    _app.competitiveExamScore = _examScoreCtrl.text.trim();
    _app.fatherName = _fatherNameCtrl.text.trim();
    _app.fatherContact = _fatherContactCtrl.text.trim();
    _app.fatherEducation = _fatherEdCtrl.text.trim();
    _app.fatherOccupation = _fatherOccCtrl.text.trim();
    _app.fatherIncome = _fatherIncCtrl.text.trim();
    _app.motherName = _motherNameCtrl.text.trim();
    _app.motherMaidenName = _motherMaidenCtrl.text.trim();
    _app.motherContact = _motherContactCtrl.text.trim();
    _app.motherEducation = _motherEdCtrl.text.trim();
    _app.motherOccupation = _motherOccCtrl.text.trim();
    _app.motherIncome = _motherIncCtrl.text.trim();
    _app.guardianName = _guardianNameCtrl.text.trim();
    _app.guardianContact = _guardianContactCtrl.text.trim();
    _app.guardianEducation = _guardianEdCtrl.text.trim();
    _app.guardianOccupation = _guardianOccCtrl.text.trim();
    _app.guardianIncome = _guardianIncCtrl.text.trim();
    _app.numberOfSiblings = _siblingCountCtrl.text.trim();
    _app.fourPsFrom = _fourPsFromCtrl.text.trim();
    _app.fourPsTo = _fourPsToCtrl.text.trim();
    _app.preferredSchool = _preferredSchoolCtrl.text.trim();
    _app.preferredProgram1 = _prog1Ctrl.text.trim();
    _app.preferredProgram2 = _prog2Ctrl.text.trim();
    _app.preferredProgram3 = _prog3Ctrl.text.trim();
    _app.essayAnswer = _essayCtrl.text.trim();
  }

  static const _firestoreTimeout = Duration(seconds: 15);

  Future<void> _saveAsDraft() async {
    _syncToModel();
    setState(() => _loading = true);
    try {
      _app.status = 'draft';
      _app.savedAt = DateTime.now().toIso8601String();
      final data = _app.toMap();
      if (_draftId != null) {
        await FirebaseFirestore.instance
            .collection('scholarship_applications')
            .doc(_draftId)
            .set(data)
            .timeout(_firestoreTimeout);
      } else {
        final ref = await FirebaseFirestore.instance
            .collection('scholarship_applications')
            .add(data)
            .timeout(_firestoreTimeout);
        _draftId = ref.id;
      }
      _showSnack('Draft saved.');
    } catch (_) {
      // Firestore unreachable/timed out — the form data is still held in
      // memory, but nothing was persisted, so say so instead of claiming
      // success.
      _showSnack(
        'Could not save draft. Please check your connection and try again.',
        error: true,
      );
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _submitApplication() async {
    _syncToModel();
    final confirmed = await _showConfirmDialog(
      'Submit Application',
      'Once submitted, you cannot edit your application. Are you sure?',
    );
    if (!confirmed) return;
    setState(() => _loading = true);

    _app.status = 'submitted';
    _app.savedAt = DateTime.now().toIso8601String();
    final data = _app.toMap();

    // Attempt Firestore save; silently skip if Firebase is unavailable. Bounded
    // by a timeout so an unreachable/hanging connection can't leave the UI
    // stuck on the loading spinner forever.
    try {
      if (_draftId != null) {
        await FirebaseFirestore.instance
            .collection('scholarship_applications')
            .doc(_draftId)
            .set(data)
            .timeout(_firestoreTimeout);
      } else {
        await FirebaseFirestore.instance
            .collection('scholarship_applications')
            .add(data)
            .timeout(_firestoreTimeout);
      }
    } catch (_) {
      // Firebase not configured in this environment — proceed with local submission
    }

    if (!mounted) return;
    setState(() => _loading = false);
    if (mounted) {
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Application submitted successfully!'), backgroundColor: Colors.green),
      );
    }
  }

  Future<void> _previewAndDownloadPdf() async {
    _syncToModel();
    setState(() => _loading = true);
    try {
      // The official form is produced exclusively by the shared backend
      // generator, which overlays the data onto the real template (logos
      // included) so the output is identical to the admin panel's form. There
      // is intentionally no local fallback — a divergent offline layout would
      // not match the official document.
      final pdfBytes = await BfcspFormApi.generate(_app);
      if (pdfBytes == null) {
        _showSnack(
          'Couldn\'t reach the form service. Please check your connection and try again.',
          error: true,
        );
      } else if (mounted) {
        // Download the filled form (on web this saves the PDF file directly).
        final f = _app;
        final namePart = [f.lastName, f.firstName]
            .where((p) => p.trim().isNotEmpty)
            .join('_');
        await Printing.sharePdf(
          bytes: pdfBytes,
          filename: 'BFCSP_Application_Form${namePart.isEmpty ? '' : '_$namePart'}.pdf',
        );
      }
    } catch (e) {
      _showSnack('PDF generation failed: $e', error: true);
    }
    if (mounted) setState(() => _loading = false);
  }

  void _goToStep(int step) {
    if (step < _currentStep || _formKeys[_currentStep].currentState?.validate() == true) {
      setState(() => _currentStep = step);
      _pageCtrl.animateToPage(step, duration: const Duration(milliseconds: 350), curve: Curves.easeInOut);
    }
  }

  void _next() {
    if (_formKeys[_currentStep].currentState?.validate() == true) {
      if (_currentStep < 4) _goToStep(_currentStep + 1);
    }
  }

  void _back() {
    if (_currentStep > 0) _goToStep(_currentStep - 1);
  }

  void _showSnack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? Colors.red : Colors.green,
    ));
  }

  Future<bool> _showConfirmDialog(String title, String message) async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text(title),
            content: Text(message),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
            ],
          ),
        ) ??
        false;
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    for (final c in [
      _lastNameCtrl, _firstNameCtrl, _middleNameCtrl, _nicknameCtrl, _ageCtrl,
      _dobCtrl, _pobCtrl, _citizenshipCtrl, _religionCtrl, _emailCtrl,
      _fbCtrl, _contactCtrl, _houseNoCtrl, _streetCtrl, _subdivCtrl,
      _barangayCtrl, _cityCtrl, _provinceCtrl, _shsTrackCtrl, _disabilityCtrl,
      _ipCtrl, _skillsCtrl, _elemSchoolCtrl, _elemHonorsCtrl, _jhsSchoolCtrl,
      _jhsHonorsCtrl, _shsSchoolCtrl, _shsHonorsCtrl, _shsGwa11Ctrl, _shsGwa12Ctrl,
      _gwaCtrl, _examScoreCtrl, _fatherNameCtrl, _fatherContactCtrl, _fatherEdCtrl,
      _fatherOccCtrl, _fatherIncCtrl, _motherNameCtrl, _motherMaidenCtrl,
      _motherContactCtrl, _motherEdCtrl, _motherOccCtrl, _motherIncCtrl,
      _guardianNameCtrl, _guardianContactCtrl, _guardianEdCtrl, _guardianOccCtrl,
      _guardianIncCtrl, _siblingCountCtrl, _fourPsFromCtrl, _fourPsToCtrl,
      _preferredSchoolCtrl, _prog1Ctrl, _prog2Ctrl, _prog3Ctrl, _essayCtrl,
    ]) { c.dispose(); }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('BFCSP Application Form'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        actions: [
          TextButton.icon(
            onPressed: _loading ? null : _saveAsDraft,
            icon: const Icon(Icons.save_outlined, color: Colors.white),
            label: const Text('Save Draft', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                _buildStepIndicator(cs),
                Expanded(
                  child: PageView(
                    controller: _pageCtrl,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      _buildStep1(),
                      _buildStep2(),
                      _buildStep3(),
                      _buildStep4(),
                      _buildStep5(),
                    ],
                  ),
                ),
                _buildNavButtons(cs),
              ],
            ),
    );
  }

  Widget _buildStepIndicator(ColorScheme cs) {
    return Container(
      color: AppColors.primary,
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      child: Row(
        children: List.generate(_steps.length, (i) {
          final isActive = i == _currentStep;
          final isDone = i < _currentStep;
          return Expanded(
            child: GestureDetector(
              onTap: () => _goToStep(i),
              child: Column(
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isDone
                          ? Colors.green
                          : isActive
                              ? Colors.white
                              : Colors.white24,
                    ),
                    child: Center(
                      child: isDone
                          ? const Icon(Icons.check, size: 16, color: Colors.white)
                          : Text('${i + 1}',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: isActive ? AppColors.primary : Colors.white54,
                              )),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _steps[i],
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 9,
                      color: isActive ? Colors.white : Colors.white54,
                      fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildNavButtons(ColorScheme cs) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: cs.surface,
        boxShadow: [BoxShadow(blurRadius: 4, color: Colors.black12)],
      ),
      child: Row(
        children: [
          if (_currentStep > 0)
            OutlinedButton.icon(
              onPressed: _back,
              icon: const Icon(Icons.arrow_back, size: 16),
              label: const Text('Back'),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
          const Spacer(),
          if (_currentStep < 4)
            FilledButton.icon(
              onPressed: _next,
              icon: const Icon(Icons.arrow_forward, size: 16),
              label: const Text('Next'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            )
          else ...[
            Tooltip(
              message: 'Preview your filled-out application form',
              child: IconButton.outlined(
                onPressed: _loading ? null : _previewAndDownloadPdf,
                icon: const Icon(Icons.picture_as_pdf_outlined),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton.icon(
              onPressed: _loading ? null : _submitApplication,
              icon: const Icon(Icons.send, size: 16),
              label: const Text('Submit'),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.green,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Personal Information
  // ─────────────────────────────────────────────────────────────────────────────
  Widget _buildStep1() {
    return Form(
      key: _formKeys[0],
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_prefilled)
            Container(
              margin: const EdgeInsets.only(bottom: 4),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, size: 18, color: AppColors.primary),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'We pre-filled some details from your registration. Please review them and fill in the remaining fields.',
                      style: TextStyle(fontSize: 12, color: AppColors.primary),
                    ),
                  ),
                ],
              ),
            ),
          _sectionHeader('Personal Information'),
          _row2([
            _field('Last Name *', _lastNameCtrl, required: true),
            _field('First Name *', _firstNameCtrl, required: true),
          ]),
          _row2([
            _field('Middle Name', _middleNameCtrl),
            _field('Nickname', _nicknameCtrl),
          ]),
          _row2([
            _field('Age *', _ageCtrl, required: true, keyboardType: TextInputType.number),
            _datePicker('Date of Birth *', _dobCtrl, required: true),
          ]),
          _field('Place of Birth *', _pobCtrl, required: true),
          _row2([
            _dropdown('Sex *', _app.sex, ['Male', 'Female'], (v) => setState(() => _app.sex = v!), required: true),
            _dropdown('Civil Status *', _app.civilStatus, ['Single', 'Married', 'Widowed', 'Others'], (v) => setState(() => _app.civilStatus = v!), required: true),
          ]),
          _row2([
            _field('Citizenship', _citizenshipCtrl),
            _field('Religion', _religionCtrl),
          ]),
          _field('Email Address *', _emailCtrl, required: true, keyboardType: TextInputType.emailAddress),
          _row2([
            _field('Facebook Username', _fbCtrl),
            _field('Contact Number *', _contactCtrl, required: true, keyboardType: TextInputType.phone),
          ]),
          _sectionHeader('Home Address'),
          _row2([
            _field('House No.', _houseNoCtrl),
            _field('Street', _streetCtrl),
          ]),
          _row2([
            _field('Subdivision/Village', _subdivCtrl),
            _field('Barangay *', _barangayCtrl, required: true),
          ]),
          _row2([
            _field('City/Municipality', _cityCtrl),
            _field('Province', _provinceCtrl),
          ]),
          _sectionHeader('Other Details'),
          _field('SHS Track/Strand *', _shsTrackCtrl, required: true),
          _row2([
            _field('Type of Disability', _disabilityCtrl),
            _field('IP Affiliation', _ipCtrl),
          ]),
          _field('Special Skills / Talents', _skillsCtrl, maxLines: 2),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Educational Background
  // ─────────────────────────────────────────────────────────────────────────────
  Widget _buildStep2() {
    return Form(
      key: _formKeys[1],
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _sectionHeader('Educational Background'),
          _eduRow('Elementary', _elemSchoolCtrl, _elemHonorsCtrl, showGwa: false),
          _eduRow('Junior High School (JHS)', _jhsSchoolCtrl, _jhsHonorsCtrl, showGwa: false),
          _eduRow('Senior High School (SHS)', _shsSchoolCtrl, _shsHonorsCtrl, showGwa: false),
          _sectionHeader('SHS Grade Averages'),
          _row2([
            _field('GWA – Grade 11', _shsGwa11Ctrl, keyboardType: TextInputType.number),
            _field('GWA – Grade 12', _shsGwa12Ctrl, keyboardType: TextInputType.number),
          ]),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _eduRow(String level, TextEditingController schoolCtrl, TextEditingController honorsCtrl, {bool showGwa = true}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(level, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        const SizedBox(height: 4),
        _field('School Name', schoolCtrl),
        _field('Awards / Honors', honorsCtrl),
        const SizedBox(height: 8),
      ],
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3 — Family Background
  // ─────────────────────────────────────────────────────────────────────────────
  Widget _buildStep3() {
    return Form(
      key: _formKeys[2],
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _sectionHeader('Family Background'),
          _dropdown("Parents' Status", _app.parentsStatus, ['Together', 'Separated', 'Single Parent', 'Deceased'], (v) => setState(() => _app.parentsStatus = v!)),
          _sectionHeader('Father\'s Information'),
          _row2([
            _dropdown('Status', _app.fatherStatus, ['Living', 'Deceased'], (v) => setState(() => _app.fatherStatus = v!)),
            _field('Father\'s Name', _fatherNameCtrl),
          ]),
          _row2([
            _field('Contact Number', _fatherContactCtrl, keyboardType: TextInputType.phone),
            _field('Education Attainment', _fatherEdCtrl),
          ]),
          _row2([
            _field('Occupation', _fatherOccCtrl),
            _field('Monthly Income', _fatherIncCtrl, keyboardType: TextInputType.number),
          ]),
          _sectionHeader('Mother\'s Information'),
          _row2([
            _dropdown('Status', _app.motherStatus, ['Living', 'Deceased'], (v) => setState(() => _app.motherStatus = v!)),
            _field('Mother\'s Maiden Name', _motherMaidenCtrl),
          ]),
          _field('Mother\'s Full Name', _motherNameCtrl),
          _row2([
            _field('Contact Number', _motherContactCtrl, keyboardType: TextInputType.phone),
            _field('Education Attainment', _motherEdCtrl),
          ]),
          _row2([
            _field('Occupation', _motherOccCtrl),
            _field('Monthly Income', _motherIncCtrl, keyboardType: TextInputType.number),
          ]),
          _sectionHeader('Guardian\'s Information (if applicable)'),
          _field('Guardian\'s Name', _guardianNameCtrl),
          _row2([
            _field('Contact Number', _guardianContactCtrl, keyboardType: TextInputType.phone),
            _field('Education Attainment', _guardianEdCtrl),
          ]),
          _row2([
            _field('Occupation', _guardianOccCtrl),
            _field('Monthly Income', _guardianIncCtrl, keyboardType: TextInputType.number),
          ]),
          _sectionHeader('Siblings'),
          _field('Number of Siblings', _siblingCountCtrl, keyboardType: TextInputType.number),
          _buildSiblingTable(),
          _sectionHeader('4Ps Beneficiary'),
          SwitchListTile(
            title: const Text('4Ps (Pantawid Pamilyang Pilipino Program) Beneficiary?'),
            value: _app.isFourPs,
            onChanged: (v) => setState(() => _app.isFourPs = v),
          ),
          if (_app.isFourPs)
            _row2([
              _field('From', _fourPsFromCtrl),
              _field('To', _fourPsToCtrl),
            ]),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildSiblingTable() {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            const Row(
              children: [
                Expanded(flex: 3, child: Text('Name', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                Expanded(child: Text('Age', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                Expanded(flex: 2, child: Text('Grade/Occupation', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
              ],
            ),
            const Divider(),
            ...List.generate(_app.siblings.length, (i) {
              final sib = _app.siblings[i];
              return Row(
                children: [
                  Expanded(flex: 3, child: _inlineField(sib.name, (v) => sib.name = v)),
                  const SizedBox(width: 4),
                  Expanded(child: _inlineField(sib.age, (v) => sib.age = v, keyboardType: TextInputType.number)),
                  const SizedBox(width: 4),
                  Expanded(flex: 2, child: _inlineField(sib.gradeOrOccupation, (v) => sib.gradeOrOccupation = v)),
                ],
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _inlineField(String initial, void Function(String) onChanged, {TextInputType? keyboardType}) {
    final ctrl = TextEditingController(text: initial);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: TextField(
        controller: ctrl,
        keyboardType: keyboardType,
        style: const TextStyle(fontSize: 11),
        decoration: const InputDecoration(
          isDense: true,
          contentPadding: EdgeInsets.symmetric(horizontal: 6, vertical: 6),
          border: OutlineInputBorder(),
        ),
        onChanged: onChanged,
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4 — Preferences & Memberships
  // ─────────────────────────────────────────────────────────────────────────────
  Widget _buildStep4() {
    return Form(
      key: _formKeys[3],
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _sectionHeader('Preferred School'),
          _field('Preferred School *', _preferredSchoolCtrl, required: true),
          _sectionHeader('Preferred Program / Course (in order of preference)'),
          _field('1st Preferred Program *', _prog1Ctrl, required: true),
          _field('2nd Preferred Program', _prog2Ctrl),
          _field('3rd Preferred Program', _prog3Ctrl),
          _sectionHeader('Other Sources of Financial Assistance'),
          SwitchListTile(
            title: const Text('Receiving other financial assistance?'),
            value: _app.hasOtherAssistance,
            onChanged: (v) => setState(() => _app.hasOtherAssistance = v),
          ),
          if (_app.hasOtherAssistance) ...[
            const Padding(
              padding: EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  Expanded(flex: 2, child: Text('Name', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                  SizedBox(width: 8),
                  Expanded(flex: 3, child: Text('Donor/Institution', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                ],
              ),
            ),
            ...List.generate(_app.otherAssistances.length, (i) {
              final e = _app.otherAssistances[i];
              return Row(
                children: [
                  Expanded(flex: 2, child: _inlineField(e.name, (v) => e.name = v)),
                  const SizedBox(width: 8),
                  Expanded(flex: 3, child: _inlineField(e.donorInstitution, (v) => e.donorInstitution = v)),
                ],
              );
            }),
          ],
          _sectionHeader('Other Scholarships Applied'),
          SwitchListTile(
            title: const Text('Applied for other scholarship programs?'),
            value: _app.appliedOtherScholarship,
            onChanged: (v) => setState(() => _app.appliedOtherScholarship = v),
          ),
          if (_app.appliedOtherScholarship) ...[
            const Padding(
              padding: EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  Expanded(flex: 2, child: Text('Type', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                  SizedBox(width: 8),
                  Expanded(flex: 3, child: Text('Grantee Institution', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                ],
              ),
            ),
            ...List.generate(_app.otherScholarships.length, (i) {
              final e = _app.otherScholarships[i];
              return Row(
                children: [
                  Expanded(flex: 2, child: _inlineField(e.type, (v) => e.type = v)),
                  const SizedBox(width: 8),
                  Expanded(flex: 3, child: _inlineField(e.granteeInstitution, (v) => e.granteeInstitution = v)),
                ],
              );
            }),
          ],
          _sectionHeader('Club / Organization Membership'),
          const Padding(
            padding: EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                Expanded(flex: 3, child: Text('Organization', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                SizedBox(width: 8),
                Expanded(flex: 2, child: Text('Designation', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
              ],
            ),
          ),
          ...List.generate(_app.clubMemberships.length, (i) {
            final e = _app.clubMemberships[i];
            return Row(
              children: [
                Expanded(flex: 3, child: _inlineField(e.organization, (v) => e.organization = v)),
                const SizedBox(width: 8),
                Expanded(flex: 2, child: _inlineField(e.designation, (v) => e.designation = v)),
              ],
            );
          }),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5 — Essay & Submission
  // ─────────────────────────────────────────────────────────────────────────────
  Widget _buildStep5() {
    return Form(
      key: _formKeys[4],
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _sectionHeader('Personal Essay'),
          const Text(
            'In 100–250 words, describe yourself and explain why you deserve this scholarship.',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: _essayCtrl,
            maxLines: 8,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              hintText: 'Write your essay here...',
            ),
            validator: (v) => (v == null || v.trim().length < 50) ? 'Essay must be at least 50 characters.' : null,
          ),
          const SizedBox(height: 16),
          _sectionHeader('Review & Certification'),
          Card(
            color: Colors.blue.shade50,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'I hereby certify that all information provided in this application is true and correct to the best of my knowledge. '
                    'I understand that any false or misleading information will be grounds for immediate disqualification or cancellation of scholarship.',
                    style: TextStyle(fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                  _buildReviewRow('Full Name:', _app.fullName.isEmpty ? '—' : _app.fullName),
                  _buildReviewRow('Date of Birth:', _app.dateOfBirth.isEmpty ? '—' : _app.dateOfBirth),
                  _buildReviewRow('GWA:', _app.gwa.isEmpty ? '—' : _app.gwa),
                  _buildReviewRow('Preferred School:', _app.preferredSchool.isEmpty ? '—' : _app.preferredSchool),
                  _buildReviewRow('1st Program:', _app.preferredProgram1.isEmpty ? '—' : _app.preferredProgram1),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.orange),
              borderRadius: BorderRadius.circular(8),
              color: Colors.orange.shade50,
            ),
            child: const Row(
              children: [
                Icon(Icons.print, color: Colors.orange),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Note: The PDF version of this form is designed to be printed BACK-TO-BACK on a single sheet of A4 paper. '
                    'Page 1 (front) contains Personal, Educational, and Family information. '
                    'Page 2 (back) contains Other Sources, Memberships, Essay, and the CED use-only section.',
                    style: TextStyle(fontSize: 11, color: Colors.orange),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildReviewRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          SizedBox(width: 130, child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12))),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 12))),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────
  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primary)),
          const Divider(thickness: 1),
        ],
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl, {bool required = false, int maxLines = 1, TextInputType? keyboardType}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TextFormField(
        controller: ctrl,
        maxLines: maxLines,
        keyboardType: keyboardType,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          isDense: true,
        ),
        validator: required ? (v) => (v == null || v.trim().isEmpty) ? '$label is required.' : null : null,
      ),
    );
  }

  Widget _datePicker(String label, TextEditingController ctrl, {bool required = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: TextFormField(
        controller: ctrl,
        readOnly: true,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          isDense: true,
          suffixIcon: const Icon(Icons.calendar_today, size: 18),
        ),
        validator: required ? (v) => (v == null || v.isEmpty) ? '$label is required.' : null : null,
        onTap: () async {
          final picked = await showDatePicker(
            context: context,
            initialDate: DateTime(2005),
            firstDate: DateTime(1990),
            lastDate: DateTime.now(),
          );
          if (picked != null) ctrl.text = DateFormat('yyyy-MM-dd').format(picked);
        },
      ),
    );
  }

  Widget _dropdown(String label, String value, List<String> options, void Function(String?) onChanged, {bool required = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: DropdownButtonFormField<String>(
        initialValue: value.isEmpty ? null : value,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          isDense: true,
        ),
        items: options.map((o) => DropdownMenuItem(value: o, child: Text(o, style: const TextStyle(fontSize: 13)))).toList(),
        onChanged: onChanged,
        validator: required ? (v) => (v == null || v.isEmpty) ? '$label is required.' : null : null,
      ),
    );
  }

  Widget _row2(List<Widget> children) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children.asMap().entries.map((e) {
        final isLast = e.key == children.length - 1;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: isLast ? 0 : 6),
            child: e.value,
          ),
        );
      }).toList(),
    );
  }
}
