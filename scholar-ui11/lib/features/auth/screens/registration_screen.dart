import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:iskonnectttt/core/constants/app_constants.dart';
import 'package:iskonnectttt/core/models/student_model.dart';
import 'package:iskonnectttt/core/services/email_service.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/core/utils/validators.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/shared/widgets/custom_button.dart';
import 'package:iskonnectttt/shared/widgets/custom_text_field.dart';
import 'package:iskonnectttt/shared/providers/school_programs_provider.dart';
import 'package:iskonnectttt/shared/widgets/dialog_helper.dart';

class RegistrationScreen extends ConsumerStatefulWidget {
  const RegistrationScreen({super.key});

  @override
  ConsumerState<RegistrationScreen> createState() => _RegistrationScreenState();
}

class _RegistrationScreenState extends ConsumerState<RegistrationScreen> {
  final _pageController = PageController();
  int _currentPage = 0;
  bool _hasAcceptedTerms = false;

  static const String _termsAndConditionsText = '''TERMS AND CONDITIONS:

1. SCREENING, QUALIFICATIONS AND ELIGIBILITY

1.1. The APPLICANT-GRANTEE shall undergo the prescribed screening process, which includes submission of all required documents, written examination, panel interview and other steps as may be prescribed by the CED.

1.2. The GRANTEE shall continuously meet the qualifications, standards, and requirements of the scholarship program.

1.3. The GRANTEE shall enroll only in Higher Education Institutions (HEIs) accredited as partner schools of the CGC Scholarship Program and located within the City of Calapan.

1.4. The GRANTEE shall carry the full academic load prescribed by the school for a regular student in his/her program.

1.5. The GRANTEE shall not drop any subject, receive a failing grade, or incur an Incomplete (INC) or Failure due to Absences (FA) mark in any enrolled course.

1.6. The GRANTEE shall maintain a General Weighted Average (GWA) of at least eighty percent (80%) or its equivalent in all semesters covered by the scholarship program.

1.7. The GRANTEE shall not shift to another academic program or transfer to another school without prior written approval of the CED.

1.8. The GRANTEE shall not have any sibling who is also a recipient of the BFCSP at the same time and for the same duration of the scholarship period.

1.9. The GRANTEE shall personally report to the CED during the designated grade reporting schedule. Failure to report and submit the required official copy of grades within the prescribed period shall result in automatic termination of the scholarship for the next semester.

1.10. The GRANTEE is required to participate in all activities officially sanctioned by the CGC through the CED. Failure to attend at least two (2) sanctioned activities per semester shall result in automatic disqualification from the scholarship program.

1.11. The GRANTEE is expected to render voluntary service to the CGC when requested or as the need arises.

2. CONDUCT AND MORALITY

2.1. The GRANTEE shall, at all times, uphold good moral character and shall not engage in any act that may bring disgrace or dishonor to oneself, the scholarship program, the CGC, or the Republic of the Philippines.

2.2. The GRANTEE shall personally report to the CED and submit an official copy of his/her grades issued by the school at the end of every semester, following the schedule set by the CED. Submission through representatives shall be allowed only upon prior written approval.

2.3. The GRANTEE must stay informed and connected by registering and actively participating in the official social media channels of the CED, including the official Facebook Page and designated group chats for city scholars.

3. EXCLUSION

The scholarship grant shall not cover summer or midyear classes, nor any form of class or program extension.

4. PAYMENT OF FEES AND OVERPAYMENT

4.1. The CGC shall pay the tuition and miscellaneous fees of the GRANTEE directly to the school, with a maximum amount of Twenty-Five Thousand Pesos (P25,000.00) per semester, subject to applicable policies and budgetary allocation.

4.2. Any overpayment or excess made by the CGC shall not be reimbursed to the GRANTEE. The scholarship grant shall be used exclusively for tuition and miscellaneous fees.

4.3. The GRANTEE shall not receive any cash allowance, and the scholarship grant shall not be convertible to cash under any circumstance.

4.4. The GRANTEE shall not avail of any other government-funded scholarship (e.g., CHED, DOST, OWWA, PGOM, etc.), whether partial or full, while receiving benefits under the BFCSP.

5. GENERAL ASSEMBLY ATTENDANCE

Mandatory attendance in the General Assembly scheduled by the CED is required. Absence without valid reason shall be subject to disciplinary action or possible disqualification.

6. POST-GRADUATION ACKNOWLEDGMENT

After graduating, the GRANTEE shall personally report to the CED and the Office of the City Mayor to acknowledge the support provided by the CGC and to formally present themselves as a graduate of the BFCSP, serving as a testament to the positive impact of the program on the youth of Calapan.

7. VIOLATION AND DISQUALIFICATION

Violation or non-compliance with any of the terms and conditions stipulated in this Agreement shall result in the automatic disqualification of the GRANTEE from the BFCSP.''';

  // Personal Info Controllers
  final _firstNameController = TextEditingController();
  final _middleNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _suffixController = TextEditingController();
  DateTime? _dateOfBirth;
  String? _gender;
  String? _profilePictureBase64;

  // Contact Controllers
  final _contactController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  // Inline email verification (server-side OTP over SMTP)
  final _codeController = TextEditingController();
  String _verifiedEmail = ''; // the email the code was verified against
  bool _codeSent = false;
  bool _sendingCode = false;
  bool _verifyingCode = false;
  bool _emailVerified = false;

  bool get _isEmailVerified =>
      _emailVerified &&
      _verifiedEmail == _emailController.text.trim().toLowerCase();

  // Address Controllers
  final _houseNoController = TextEditingController();
  final _streetController = TextEditingController();
  String? _barangay;

  // Academic Controllers
  String? _schoolName;
  String? _academicProgram;

  @override
  void dispose() {
    _pageController.dispose();
    _firstNameController.dispose();
    _middleNameController.dispose();
    _lastNameController.dispose();
    _suffixController.dispose();
    _contactController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _codeController.dispose();
    _houseNoController.dispose();
    _streetController.dispose();
    super.dispose();
  }

  void _nextPage() {
    if (_currentPage < 3) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void _previousPage() {
    if (_currentPage > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      context.pop();
    }
  }

  bool _validateCurrentPage() {
    switch (_currentPage) {
      case 0:
        if (_firstNameController.text.isEmpty ||
            _lastNameController.text.isEmpty ||
            _dateOfBirth == null ||
            _gender == null) {
          DialogHelper.showWarningDialog(
            context: context,
            title: 'Incomplete Information',
            message: 'Please fill in all required fields.',
          );
          return false;
        }
        return true;
      case 1:
        if (_streetController.text.isEmpty || _barangay == null) {
          DialogHelper.showWarningDialog(
            context: context,
            title: 'Incomplete Information',
            message: 'Please fill in street and barangay.',
          );
          return false;
        }
        return true;
      case 2:
        if (_contactController.text.isEmpty ||
            _emailController.text.isEmpty ||
            _passwordController.text.isEmpty ||
            _confirmPasswordController.text.isEmpty) {
          DialogHelper.showWarningDialog(
            context: context,
            title: 'Incomplete Information',
            message: 'Please fill in all contact and account fields.',
          );
          return false;
        }
        if (_passwordController.text != _confirmPasswordController.text) {
          DialogHelper.showWarningDialog(
            context: context,
            title: 'Password Mismatch',
            message: 'Passwords do not match.',
          );
          return false;
        }
        if (!_isEmailVerified) {
          DialogHelper.showWarningDialog(
            context: context,
            title: 'Email Not Verified',
            message:
                'Please verify your email address. Tap "Send Verification Code", then enter the 6-digit code we send you.',
          );
          return false;
        }
        return true;
      case 3:
        if (_schoolName == null || _academicProgram == null) {
          DialogHelper.showWarningDialog(
            context: context,
            title: 'Incomplete Information',
            message: 'Please fill in all academic fields.',
          );
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  void _showImagePickerOptions() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.divider,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Choose Profile Photo',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 20),
              ListTile(
                leading: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.camera_alt, color: AppColors.primary),
                ),
                title: const Text('Take a Photo'),
                subtitle: const Text('Use your camera'),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.camera);
                },
              ),
              ListTile(
                leading: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.secondary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.photo_library, color: AppColors.secondary),
                ),
                title: const Text('Choose from Gallery'),
                subtitle: const Text('Select from your photos'),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.gallery);
                },
              ),
              if (_profilePictureBase64 != null)
                ListTile(
                  leading: Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.error.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(Icons.delete, color: AppColors.error),
                  ),
                  title: const Text('Remove Photo'),
                  subtitle: const Text('Delete current photo'),
                  onTap: () {
                    Navigator.pop(context);
                    setState(() {
                      _profilePictureBase64 = null;
                    });
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picker = ImagePicker();
      final pickedFile = await picker.pickImage(
        source: source,
        maxWidth: 512,
        maxHeight: 512,
        imageQuality: 75,
      );

      if (pickedFile != null) {
        final bytes = await pickedFile.readAsBytes();
        setState(() {
          _profilePictureBase64 = base64Encode(bytes);
        });
      }
    } catch (e) {
      if (mounted) {
        DialogHelper.showErrorDialog(
          context: context,
          title: 'Error',
          message: 'Unable to select image. Please try again.',
        );
      }
    }
  }

  Future<void> _handleSubmit() async {
    if (!_validateCurrentPage()) return;

    if (!_hasAcceptedTerms) {
      DialogHelper.showWarningDialog(
        context: context,
        title: 'Terms Required',
        message: 'Please accept the Terms and Conditions before submitting.',
      );
      return;
    }

    // Additional validation — enforce the strong-password policy.
    final passwordError = Validators.strongPassword(_passwordController.text);
    if (passwordError != null) {
      DialogHelper.showWarningDialog(
        context: context,
        title: 'Weak Password',
        message:
            'Password must be at least 8 characters and include uppercase, lowercase, a number and a special character.',
      );
      return;
    }

    if (_passwordController.text != _confirmPasswordController.text) {
      DialogHelper.showWarningDialog(
        context: context,
        title: 'Password Mismatch',
        message: 'Passwords do not match. Please check and try again.',
      );
      return;
    }

    try {
      final authNotifier = ref.read(authStateProvider.notifier);
      final student = StudentModel(
        firstName: _firstNameController.text.trim(),
        middleName: _middleNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        suffix: _suffixController.text.trim(),
        houseNo: _houseNoController.text.trim(),
        street: _streetController.text.trim(),
        barangay: _barangay!,
        city: AppConstants.city,
        province: AppConstants.province,
        gender: _gender!,
        dateOfBirth: _dateOfBirth!,
        contactNumber: _contactController.text.trim(),
        email: _emailController.text.trim().toLowerCase(),
        password: _passwordController.text,
        schoolName: _schoolName!,
        // New applicants start at 1st Year, 1st Semester by default.
        yearLevel: '1',
        academicProgram: _academicProgram!,
        academicYear: '',
        semester: '1st Semester',
        profilePicture: _profilePictureBase64,
      );

      final success = await authNotifier.register(student);

      if (success && mounted) {
        final pendingStudent = authNotifier.getPendingRegistration();
        if (pendingStudent != null) {
          await authNotifier.loginWithStudent(pendingStudent);
        }
        authNotifier.clearPendingRegistration();
        if (mounted) {
          // Email was already verified inline on the Contact & Account step.
          context.go('/registration-success');
        }
      } else if (mounted) {
        final error = ref.read(authStateProvider).error;
        DialogHelper.showErrorDialog(
          context: context,
          title: 'Registration Failed',
          message:
              error ??
              'An error occurred during registration. Please try again.',
        );
      }
    } catch (e) {
      if (mounted) {
        DialogHelper.showErrorDialog(
          context: context,
          title: 'Error',
          message:
              'Unable to complete registration. Please check your connection and try again.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          // Header with gradient
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [AppColors.primaryDark, AppColors.primary],
              ),
            ),
            child: SafeArea(
              bottom: false,
              child: Column(
                children: [
                  // Custom App Bar
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(
                            Icons.arrow_back_ios_new,
                            color: Colors.white,
                            size: 20,
                          ),
                          onPressed: _previousPage,
                        ),
                        const Expanded(
                          child: Text(
                            'Create Account',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                              letterSpacing: 0.3,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const SizedBox(width: 48), // Balance the back button
                      ],
                    ),
                  ),
                  // Progress section
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    child: Column(
                      children: [
                        // Step indicators with icons - CENTERED
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(4, (index) {
                            final isActive = index <= _currentPage;
                            final isCompleted = index < _currentPage;
                            return Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 32,
                                  height: 32,
                                  decoration: BoxDecoration(
                                    color: isActive
                                        ? Colors.white
                                        : Colors.white.withValues(alpha: 0.2),
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: Colors.white.withValues(
                                        alpha: 0.3,
                                      ),
                                      width: 1.5,
                                    ),
                                  ),
                                  child: Center(
                                    child: isCompleted
                                        ? Icon(
                                            Icons.check,
                                            size: 16,
                                            color: AppColors.primary,
                                          )
                                        : Text(
                                            '${index + 1}',
                                            style: TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.bold,
                                              color: isActive
                                                  ? AppColors.primary
                                                  : Colors.white,
                                            ),
                                          ),
                                  ),
                                ),
                                if (index < 3)
                                  Container(
                                    width: 40,
                                    height: 2,
                                    margin: const EdgeInsets.symmetric(
                                      horizontal: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: index < _currentPage
                                          ? Colors.white
                                          : Colors.white.withValues(alpha: 0.2),
                                      borderRadius: BorderRadius.circular(2),
                                    ),
                                  ),
                              ],
                            );
                          }),
                        ),
                        const SizedBox(height: 12),
                        // Current step info - CENTERED
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Icon(
                                _getPageIcon(),
                                color: Colors.white,
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _getPageTitle(),
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Step ${_currentPage + 1} of 4',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: Colors.white.withValues(alpha: 0.8),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Form Pages
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              onPageChanged: (page) {
                setState(() {
                  _currentPage = page;
                });
              },
              children: [
                _buildPersonalInfoPage(),
                _buildAddressPage(),
                _buildContactPage(),
                _buildAcademicPage(),
              ],
            ),
          ),
          // Navigation Buttons
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.surface,
              boxShadow: [
                BoxShadow(
                  color: AppColors.cardShadow.withValues(alpha: 0.1),
                  blurRadius: 10,
                  offset: const Offset(0, -5),
                ),
              ],
            ),
            child: Row(
              children: [
                if (_currentPage > 0)
                  Expanded(
                    child: CustomButton(
                      text: 'Back',
                      onPressed: _previousPage,
                      isOutlined: true,
                    ),
                  ),
                if (_currentPage > 0) const SizedBox(width: 16),
                Expanded(
                  flex: _currentPage > 0 ? 2 : 1,
                  child: GradientButton(
                    text: _currentPage < 3 ? 'Continue' : 'Submit',
                    isLoading: authState.isLoading,
                    onPressed: () {
                      if (_validateCurrentPage()) {
                        if (_currentPage < 3) {
                          _nextPage();
                        } else {
                          _handleSubmit();
                        }
                      }
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  IconData _getPageIcon() {
    switch (_currentPage) {
      case 0:
        return Icons.person_outline;
      case 1:
        return Icons.location_on_outlined;
      case 2:
        return Icons.email_outlined;
      case 3:
        return Icons.school_outlined;
      default:
        return Icons.info_outline;
    }
  }

  String _getPageTitle() {
    switch (_currentPage) {
      case 0:
        return 'Personal Information';
      case 1:
        return 'Address';
      case 2:
        return 'Contact & Account';
      case 3:
        return 'Academic Information';
      default:
        return '';
    }
  }

  Widget _buildPersonalInfoPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Profile Picture Section
          Center(
            child: Column(
              children: [
                GestureDetector(
                  onTap: _showImagePickerOptions,
                  child: Stack(
                    children: [
                      Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceVariant,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppColors.primary.withValues(alpha: 0.3),
                            width: 3,
                          ),
                          image: _profilePictureBase64 != null
                              ? DecorationImage(
                                  image: MemoryImage(
                                    base64Decode(_profilePictureBase64!),
                                  ),
                                  fit: BoxFit.cover,
                                )
                              : null,
                        ),
                        child: _profilePictureBase64 == null
                            ? Icon(
                                Icons.person,
                                size: 50,
                                color: AppColors.textTertiary,
                              )
                            : null,
                      ),
                      Positioned(
                        bottom: 0,
                        right: 0,
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                          ),
                          child: const Icon(
                            Icons.camera_alt,
                            size: 16,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Add Profile Photo',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.primary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  '(Optional)',
                  style: TextStyle(fontSize: 11, color: AppColors.textTertiary),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          CustomTextField(
            controller: _firstNameController,
            label: 'First Name *',
            hint: 'Enter your first name',
            prefixIcon: Icons.person_outline,
            textInputAction: TextInputAction.next,
            validator: (v) => Validators.name(v, fieldName: 'First name'),
          ),
          const SizedBox(height: 16),
          CustomTextField(
            controller: _middleNameController,
            label: 'Middle Name',
            hint: 'Enter your middle name',
            prefixIcon: Icons.person_outline,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 16),
          CustomTextField(
            controller: _lastNameController,
            label: 'Last Name *',
            hint: 'Enter your last name',
            prefixIcon: Icons.person_outline,
            textInputAction: TextInputAction.next,
            validator: (v) => Validators.name(v, fieldName: 'Last name'),
          ),
          const SizedBox(height: 16),
          CustomTextField(
            controller: _suffixController,
            label: 'Suffix',
            hint: 'Jr., Sr., III, etc.',
            prefixIcon: Icons.badge_outlined,
          ),
          const SizedBox(height: 16),
          CustomDatePicker(
            label: 'Date of Birth *',
            hint: 'Select your date of birth',
            value: _dateOfBirth,
            firstDate: DateTime(1970),
            lastDate: DateTime.now().subtract(const Duration(days: 365 * 16)),
            onChanged: (date) {
              setState(() {
                _dateOfBirth = date;
              });
            },
            validator: Validators.dateOfBirth,
          ),
          const SizedBox(height: 16),
          CustomDropdown<String>(
            label: 'Gender *',
            hint: 'Select your gender',
            value: _gender,
            prefixIcon: Icons.wc_outlined,
            items: AppConstants.genders.map((g) {
              return DropdownMenuItem(value: g, child: Text(g));
            }).toList(),
            onChanged: (value) {
              setState(() {
                _gender = value;
              });
            },
            validator: (v) => Validators.dropdown(v, fieldName: 'gender'),
          ),
        ],
      ),
    );
  }

  Widget _buildAddressPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.infoLight,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, color: AppColors.info, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'You must be a resident of ${AppConstants.city} to be eligible for this scholarship.',
                    style: const TextStyle(fontSize: 12, color: AppColors.info),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          CustomTextField(
            controller: _houseNoController,
            label: 'House/Block/Lot Number',
            hint: 'e.g., 123, Block 5 Lot 10 (Optional)',
            prefixIcon: Icons.home_outlined,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 16),
          CustomTextField(
            controller: _streetController,
            label: 'Street *',
            hint: 'Enter street name',
            prefixIcon: Icons.signpost_outlined,
            textInputAction: TextInputAction.next,
            validator: Validators.street,
          ),
          const SizedBox(height: 16),
          CustomDropdown<String>(
            label: 'Barangay *',
            hint: 'Select your barangay',
            value: _barangay,
            prefixIcon: Icons.location_on_outlined,
            items: AppConstants.barangays.map((b) {
              return DropdownMenuItem(value: b, child: Text(b));
            }).toList(),
            onChanged: (value) {
              setState(() {
                _barangay = value;
              });
            },
            validator: (v) => Validators.dropdown(v, fieldName: 'barangay'),
          ),
          const SizedBox(height: 16),
          CustomTextField(
            label: 'City',
            hint: AppConstants.city,
            prefixIcon: Icons.location_city_outlined,
            readOnly: true,
            controller: TextEditingController(text: AppConstants.city),
          ),
          const SizedBox(height: 16),
          CustomTextField(
            label: 'Province',
            hint: AppConstants.province,
            prefixIcon: Icons.map_outlined,
            readOnly: true,
            controller: TextEditingController(text: AppConstants.province),
          ),
        ],
      ),
    );
  }

  // Send a 6-digit verification code to the entered email address.
  Future<void> _sendEmailCode() async {
    final email = _emailController.text.trim().toLowerCase();
    final emailError = Validators.email(email);
    if (emailError != null) {
      DialogHelper.showWarningDialog(
        context: context,
        title: 'Invalid Email',
        message: 'Please enter a valid email address first.',
      );
      return;
    }

    setState(() {
      _sendingCode = true;
      _emailVerified = false;
    });

    final result = await EmailService.sendVerificationCode(toEmail: email);

    if (!mounted) return;
    setState(() {
      _sendingCode = false;
      _codeSent = result.success;
    });

    if (result.success) {
      // In dev/emulator mode (no SMTP) the server returns the code so it can be
      // shown here for testing; production never sends devCode.
      if (result.devCode != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Dev mode — your code is ${result.devCode}'),
            backgroundColor: Colors.blue,
            duration: const Duration(seconds: 8),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Verification code sent. Check your email.'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } else {
      DialogHelper.showErrorDialog(
        context: context,
        title: 'Could Not Send Code',
        message: result.message,
      );
    }
  }

  // Verify the typed code against the server.
  Future<void> _verifyEmailCode() async {
    final code = _codeController.text.trim();
    if (code.length < 6) {
      DialogHelper.showWarningDialog(
        context: context,
        title: 'Incomplete Code',
        message: 'Please enter the 6-digit code sent to your email.',
      );
      return;
    }

    setState(() => _verifyingCode = true);
    final result = await EmailService.verifyCode(
      toEmail: _emailController.text.trim().toLowerCase(),
      code: code,
    );
    if (!mounted) return;
    setState(() => _verifyingCode = false);

    if (result.success) {
      setState(() {
        _emailVerified = true;
        _verifiedEmail = _emailController.text.trim().toLowerCase();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Email verified successfully!'),
          backgroundColor: Colors.green,
        ),
      );
    } else {
      setState(() => _emailVerified = false);
      DialogHelper.showWarningDialog(
        context: context,
        title: 'Incorrect Code',
        message: result.message,
      );
    }
  }

  Widget _buildEmailVerificationSection() {
    if (_isEmailVerified) {
      return Container(
        margin: const EdgeInsets.only(top: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.success.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.success.withValues(alpha: 0.4)),
        ),
        child: const Row(
          children: [
            Icon(Icons.verified_rounded, color: AppColors.success, size: 20),
            SizedBox(width: 8),
            Text(
              'Email verified',
              style: TextStyle(
                color: AppColors.success,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _sendingCode ? null : _sendEmailCode,
            icon: _sendingCode
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.send_rounded, size: 18),
            label: Text(_codeSent ? 'Resend Code' : 'Send Verification Code'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              side: const BorderSide(color: AppColors.primary),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
        if (_codeSent) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: CustomTextField(
                  controller: _codeController,
                  label: 'Enter 6-Digit Code *',
                  hint: '••••••',
                  prefixIcon: Icons.pin_outlined,
                  keyboardType: TextInputType.number,
                ),
              ),
              const SizedBox(width: 12),
              Padding(
                padding: const EdgeInsets.only(top: 24),
                child: ElevatedButton(
                  onPressed: _verifyingCode ? null : _verifyEmailCode,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 16,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _verifyingCode
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Verify'),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildContactPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CustomTextField(
            controller: _contactController,
            label: 'Contact Number *',
            hint: '09XX XXX XXXX',
            prefixIcon: Icons.phone_outlined,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.next,
            validator: Validators.phoneNumber,
          ),
          const SizedBox(height: 16),
          CustomTextField(
            controller: _emailController,
            label: 'Email Address *',
            hint: 'Enter your email',
            prefixIcon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            validator: Validators.email,
            onChanged: (_) {
              // Re-verification required if the email changes after verifying.
              if (_emailVerified || _codeSent) {
                setState(() {
                  _emailVerified = false;
                  _codeSent = false;
                  _codeController.clear();
                });
              }
            },
          ),
          _buildEmailVerificationSection(),
          const SizedBox(height: 24),
          const Divider(),
          const SizedBox(height: 16),
          const Text(
            'Create Your Password',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          CustomTextField(
            controller: _passwordController,
            label: 'Password *',
            hint: 'Min 8 chars, upper, lower, number & symbol',
            prefixIcon: Icons.lock_outline,
            obscureText: _obscurePassword,
            textInputAction: TextInputAction.next,
            validator: Validators.strongPassword,
            suffixIcon: IconButton(
              icon: Icon(
                _obscurePassword
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
                size: 20,
              ),
              onPressed: () {
                setState(() {
                  _obscurePassword = !_obscurePassword;
                });
              },
            ),
          ),
          const SizedBox(height: 16),
          CustomTextField(
            controller: _confirmPasswordController,
            label: 'Confirm Password *',
            hint: 'Re-enter your password',
            prefixIcon: Icons.lock_outline,
            obscureText: _obscureConfirmPassword,
            textInputAction: TextInputAction.done,
            validator: (v) =>
                Validators.confirmPassword(v, _passwordController.text),
            suffixIcon: IconButton(
              icon: Icon(
                _obscureConfirmPassword
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
                size: 20,
              ),
              onPressed: () {
                setState(() {
                  _obscureConfirmPassword = !_obscureConfirmPassword;
                });
              },
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Password Requirements:',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 8),
                _buildPasswordRequirement('At least 8 characters'),
                _buildPasswordRequirement('Contains letters and numbers'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPasswordRequirement(String text) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          const Icon(
            Icons.check_circle,
            size: 14,
            color: AppColors.textTertiary,
          ),
          const SizedBox(width: 8),
          Text(
            text,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  void _showTermsAndConditionsDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Terms and Conditions'),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Text(
                _termsAndConditionsText,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            ),
          ],
        );
      },
    );
  }

  Widget _buildAcademicPage() {
    final schoolsAsync = ref.watch(schoolsProvider);
    final programsAsync = ref.watch(programsProvider);
    final programsBySchoolAsync = ref.watch(programsBySchoolProvider);

    final schools = schoolsAsync.valueOrNull ?? AppConstants.schools;
    final programsBySchool =
        programsBySchoolAsync.valueOrNull ?? AppConstants.programsBySchool;

    // Only the programs offered by the selected school. A school with no
    // programs configured shows an empty list (not every program in the system).
    final filteredPrograms = _schoolName == null
        ? <String>[]
        : (programsBySchool[_schoolName] ?? <String>[]);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (schoolsAsync.isLoading)
            const LinearProgressIndicator()
          else
            CustomDropdown<String>(
              label: 'School Name *',
              hint: 'Select your school',
              value: _schoolName,
              prefixIcon: Icons.school_outlined,
              items: schools.map((s) {
                return DropdownMenuItem(value: s, child: Text(s));
              }).toList(),
              onChanged: (value) {
                setState(() {
                  _schoolName = value;
                  _academicProgram = null;
                });
              },
              validator: (v) => Validators.dropdown(v, fieldName: 'school'),
            ),
          const SizedBox(height: 16),
          if (programsAsync.isLoading)
            const LinearProgressIndicator()
          else
            CustomDropdown<String>(
              label: 'Academic Program *',
              hint: _schoolName == null
                  ? 'Select a school first'
                  : 'Select your academic program',
              value: _academicProgram,
              prefixIcon: Icons.menu_book_outlined,
              items: filteredPrograms.map((program) {
                return DropdownMenuItem(value: program, child: Text(program));
              }).toList(),
              onChanged: (value) {
                setState(() {
                  _academicProgram = value;
                });
              },
              validator: (v) => Validators.dropdown(v, fieldName: 'program'),
            ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Checkbox(
                  value: _hasAcceptedTerms,
                  onChanged: (value) {
                    setState(() {
                      _hasAcceptedTerms = value ?? false;
                    });
                  },
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 8),
                      const Text(
                        'I agree to the Terms and Conditions.',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      TextButton(
                        onPressed: _showTermsAndConditionsDialog,
                        style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(0, 0),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          alignment: Alignment.centerLeft,
                        ),
                        child: const Text('Read more'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
