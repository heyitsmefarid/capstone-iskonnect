import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/core/utils/validators.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/shared/widgets/custom_app_bar.dart';
import 'package:iskonnectttt/shared/widgets/custom_button.dart';
import 'package:iskonnectttt/shared/widgets/custom_text_field.dart';
import 'package:iskonnectttt/shared/widgets/dialog_helper.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _firstNameController;
  late TextEditingController _middleNameController;
  late TextEditingController _lastNameController;
  late TextEditingController _suffixController;
  late TextEditingController _genderController;
  late TextEditingController _dobController;
  late TextEditingController _houseNoController;
  late TextEditingController _streetController;
  late TextEditingController _barangayController;
  late TextEditingController _cityController;
  late TextEditingController _provinceController;
  late TextEditingController _contactController;
  late TextEditingController _emailController;
  late TextEditingController _schoolController;
  late TextEditingController _programController;
  late TextEditingController _yearLevelController;
  late TextEditingController _academicYearController;

  DateTime? _dob;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final s = ref.read(currentStudentProvider);
    _firstNameController = TextEditingController(text: s?.firstName ?? '');
    _middleNameController = TextEditingController(text: s?.middleName ?? '');
    _lastNameController = TextEditingController(text: s?.lastName ?? '');
    _suffixController = TextEditingController(text: s?.suffix ?? '');
    _genderController = TextEditingController(text: s?.gender ?? '');
    _dob = s?.dateOfBirth;
    _dobController = TextEditingController(
      text: _dob != null ? _formatDob(_dob!) : '',
    );
    _houseNoController = TextEditingController(text: s?.houseNo ?? '');
    _streetController = TextEditingController(text: s?.street ?? '');
    _barangayController = TextEditingController(text: s?.barangay ?? '');
    _cityController = TextEditingController(text: s?.city ?? '');
    _provinceController = TextEditingController(text: s?.province ?? '');
    _contactController = TextEditingController(text: s?.contactNumber ?? '');
    _emailController = TextEditingController(text: s?.email ?? '');
    _schoolController = TextEditingController(text: s?.schoolName ?? '');
    _programController = TextEditingController(text: s?.academicProgram ?? '');
    _yearLevelController = TextEditingController(text: s?.yearLevel ?? '');
    _academicYearController = TextEditingController(text: s?.academicYear ?? '');
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _middleNameController.dispose();
    _lastNameController.dispose();
    _suffixController.dispose();
    _genderController.dispose();
    _dobController.dispose();
    _houseNoController.dispose();
    _streetController.dispose();
    _barangayController.dispose();
    _cityController.dispose();
    _provinceController.dispose();
    _contactController.dispose();
    _emailController.dispose();
    _schoolController.dispose();
    _programController.dispose();
    _yearLevelController.dispose();
    _academicYearController.dispose();
    super.dispose();
  }

  String _formatDob(DateTime d) => '${d.month}/${d.day}/${d.year}';

  Future<void> _pickDob() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dob ?? DateTime(2000),
      firstDate: DateTime(1950),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() {
        _dob = picked;
        _dobController.text = _formatDob(picked);
      });
    }
  }

  String? _requiredField(String? value) {
    if (value == null || value.trim().isEmpty) return 'This field is required';
    return null;
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    ref.read(authStateProvider.notifier).updateProfile(
          firstName: _firstNameController.text.trim(),
          middleName: _middleNameController.text.trim(),
          lastName: _lastNameController.text.trim(),
          suffix: _suffixController.text.trim(),
          gender: _genderController.text.trim(),
          dateOfBirth: _dob,
          houseNo: _houseNoController.text.trim(),
          street: _streetController.text.trim(),
          barangay: _barangayController.text.trim(),
          city: _cityController.text.trim(),
          province: _provinceController.text.trim(),
          contactNumber: _contactController.text.trim(),
          email: _emailController.text.trim(),
          schoolName: _schoolController.text.trim(),
          academicProgram: _programController.text.trim(),
          yearLevel: _yearLevelController.text.trim(),
          academicYear: _academicYearController.text.trim(),
        );

    setState(() => _isLoading = false);

    if (mounted) {
      DialogHelper.showSuccessDialog(
        context: context,
        title: 'Profile Updated',
        message: 'Your profile information has been updated successfully.',
        onPressed: () => context.pop(),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final student = ref.watch(currentStudentProvider);

    if (student == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Scaffold(
      appBar: const CustomAppBar(title: 'Edit Profile'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Info Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.infoLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.info.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  children: const [
                    Icon(Icons.info_outline, color: AppColors.info, size: 20),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Keep your information up to date. You can edit any field below and save.',
                        style: TextStyle(fontSize: 12, color: AppColors.info),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              _SectionTitle('Personal Information'),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _firstNameController,
                label: 'First Name',
                prefixIcon: Icons.person_outline,
                validator: _requiredField,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _middleNameController,
                label: 'Middle Name',
                prefixIcon: Icons.person_outline,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _lastNameController,
                label: 'Last Name',
                prefixIcon: Icons.person_outline,
                validator: _requiredField,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _suffixController,
                label: 'Suffix (optional)',
                hint: 'Jr., Sr., III',
                prefixIcon: Icons.badge_outlined,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _genderController,
                label: 'Gender',
                prefixIcon: Icons.wc_outlined,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _dobController,
                label: 'Date of Birth',
                hint: 'MM/DD/YYYY',
                prefixIcon: Icons.cake_outlined,
                readOnly: true,
                onTap: _pickDob,
              ),

              const SizedBox(height: 28),
              const Divider(),
              const SizedBox(height: 20),

              _SectionTitle('Address'),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _houseNoController,
                label: 'House No.',
                prefixIcon: Icons.home_outlined,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _streetController,
                label: 'Street',
                prefixIcon: Icons.signpost_outlined,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _barangayController,
                label: 'Barangay',
                prefixIcon: Icons.location_on_outlined,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _cityController,
                label: 'City / Municipality',
                prefixIcon: Icons.location_city_outlined,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _provinceController,
                label: 'Province',
                prefixIcon: Icons.map_outlined,
              ),

              const SizedBox(height: 28),
              const Divider(),
              const SizedBox(height: 20),

              _SectionTitle('Contact Information'),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _contactController,
                label: 'Contact Number',
                hint: '09XX XXX XXXX',
                prefixIcon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
                validator: Validators.phoneNumber,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _emailController,
                label: 'Email Address',
                hint: 'your.email@example.com',
                prefixIcon: Icons.email_outlined,
                keyboardType: TextInputType.emailAddress,
                validator: Validators.email,
              ),

              const SizedBox(height: 28),
              const Divider(),
              const SizedBox(height: 20),

              _SectionTitle('Academic Information'),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _schoolController,
                label: 'School',
                prefixIcon: Icons.school_outlined,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _programController,
                label: 'Program / Course',
                prefixIcon: Icons.menu_book_outlined,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _yearLevelController,
                label: 'Year Level',
                hint: '1, 2, 3, 4',
                prefixIcon: Icons.grade_outlined,
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _academicYearController,
                label: 'Academic Year',
                hint: '2025-2026',
                prefixIcon: Icons.calendar_today_outlined,
              ),

              const SizedBox(height: 36),

              GradientButton(
                text: 'Save Changes',
                onPressed: _handleSave,
                isLoading: _isLoading,
                width: double.infinity,
              ),
              const SizedBox(height: 16),
              CustomButton(
                text: 'Cancel',
                onPressed: () => context.pop(),
                isOutlined: true,
                width: double.infinity,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
    );
  }
}
