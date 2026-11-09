import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../config/theme.dart';
import '../models/registration_data.dart';
import '../services/registration_service.dart';
import '../widgets/bawaal_logo_lockup.dart';
import '../widgets/glow_text_field.dart';
import '../widgets/otp_modal.dart';
import '../widgets/sports_picker_sheet.dart';
import 'terms_screen.dart';

class RegistrationPage extends StatefulWidget {
  const RegistrationPage({
    super.key,
    this.service,
    this.onRegistered,
  });

  final RegistrationService? service;
  final void Function(RegistrationData data, String userId)? onRegistered;

  @override
  State<RegistrationPage> createState() => _RegistrationPageState();
}

class _RegistrationPageState extends State<RegistrationPage> {
  final _formKey = GlobalKey<FormState>();
  late final RegistrationService _service;

  final _userName = TextEditingController();
  final _realName = TextEditingController();
  final _age = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _location = TextEditingController();

  static const _genders = [
    'Male',
    'Female',
    'Other',
    'Prefer not to say',
  ];

  static const _roles = ['Fan', 'Athlete', 'Coach', 'Scout'];

  String? _gender;
  String? _role;
  String? _sport;
  bool _acceptedTerms = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _service = widget.service ?? RegistrationService();
  }

  @override
  void dispose() {
    _userName.dispose();
    _realName.dispose();
    _age.dispose();
    _email.dispose();
    _phone.dispose();
    _location.dispose();
    super.dispose();
  }

  RegistrationData _buildData() {
    return RegistrationData(
      userName: _userName.text,
      realName: _realName.text,
      age: int.parse(_age.text.trim()),
      gender: _gender!,
      email: _email.text,
      phone: _phone.text,
      location: _location.text,
      sport: _sport!,
      role: _role!,
    );
  }

  Future<void> _openTerms() async {
    final agreed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const TermsScreen()),
    );
    if (agreed == true && mounted) {
      setState(() => _acceptedTerms = true);
    }
  }

  Future<void> _pickSport() async {
    final selected = await showSportsPickerSheet(
      context,
      selected: _sport,
    );
    if (selected != null && mounted) {
      setState(() => _sport = selected);
    }
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final valid = _formKey.currentState?.validate() ?? false;
    if (!valid) return;
    if (_gender == null || _role == null || _sport == null) {
      _toast('Please complete Gender, Sports, and Role.');
      return;
    }
    if (!_acceptedTerms) {
      _toast('Accept Terms and Conditions to continue.');
      return;
    }

    final data = _buildData();
    setState(() => _submitting = true);

    final result = await _service.register(data);
    if (!mounted) return;
    setState(() => _submitting = false);

    if (!result.ok) {
      _toast(result.errorMessage ?? 'Registration failed.');
      return;
    }

    final verified = await OtpModal.show(
      context,
      email: data.email.trim(),
      onVerify: (otp) async {
        final verify = await _service.verifyEmailOtp(
          email: data.email,
          token: otp,
          data: data,
        );
        if (!verify.ok) return verify.errorMessage ?? 'Invalid OTP.';
        widget.onRegistered?.call(data, verify.userId ?? result.userId ?? '');
        return null;
      },
      onResend: () => _service.resendSignupOtp(data.email),
    );

    if (!mounted) return;
    if (verified == true) {
      _toast('Welcome to BAWAAL. Profile locked in.', success: true);
    }
  }

  void _toast(String message, {bool success = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: success ? BawaalColors.success : BawaalColors.surface,
        content: Text(message),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final canContinue = _acceptedTerms && !_submitting;

    return Scaffold(
      backgroundColor: BawaalColors.background,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(18, 22, 18, 20),
                decoration: BoxDecoration(
                  color: BawaalColors.surface,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: Colors.white10),
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const BawaalLogoLockup(),
                      const SizedBox(height: 26),
                      GlowTextField(
                        controller: _userName,
                        label: 'User Name',
                        hint: '@handle',
                        glowOnFocus: true,
                        textInputAction: TextInputAction.next,
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) {
                            return 'User name is required';
                          }
                          if (v.trim().length < 3) {
                            return 'At least 3 characters';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      GlowTextField(
                        controller: _realName,
                        label: 'Real Name',
                        textInputAction: TextInputAction.next,
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) {
                            return 'Real name is required';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: GlowTextField(
                              controller: _age,
                              label: 'Age',
                              keyboardType: TextInputType.number,
                              textInputAction: TextInputAction.next,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(3),
                              ],
                              validator: (v) {
                                final n = int.tryParse(v?.trim() ?? '');
                                if (n == null) return 'Enter age';
                                if (n < 13 || n > 100) return 'Age 13–100';
                                return null;
                              },
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _DropdownField<String>(
                              label: 'Gender',
                              value: _gender,
                              items: _genders,
                              onChanged: (v) => setState(() => _gender = v),
                              validator: (v) =>
                                  v == null ? 'Select gender' : null,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      GlowTextField(
                        controller: _email,
                        label: 'Email ID',
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        validator: (v) {
                          final email = v?.trim() ?? '';
                          if (email.isEmpty) return 'Email is required';
                          final ok = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                              .hasMatch(email);
                          if (!ok) return 'Enter a valid email';
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: GlowTextField(
                              controller: _phone,
                              label: 'Phone No',
                              keyboardType: TextInputType.phone,
                              textInputAction: TextInputAction.next,
                              inputFormatters: [
                                FilteringTextInputFormatter.allow(
                                  RegExp(r'[0-9+\-\s]'),
                                ),
                              ],
                              validator: (v) {
                                final digits = (v ?? '')
                                    .replaceAll(RegExp(r'\D'), '');
                                if (digits.length < 10) {
                                  return 'Enter phone';
                                }
                                return null;
                              },
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: GlowTextField(
                              controller: _location,
                              label: 'Location',
                              textInputAction: TextInputAction.next,
                              validator: (v) {
                                if (v == null || v.trim().isEmpty) {
                                  return 'Location required';
                                }
                                return null;
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: _SelectorField(
                              label: 'Sports',
                              value: _sport,
                              placeholder: 'Select sport',
                              onTap: _pickSport,
                              validator: (_) =>
                                  _sport == null ? 'Select a sport' : null,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _DropdownField<String>(
                              label: 'I am a',
                              value: _role,
                              items: _roles,
                              onChanged: (v) => setState(() => _role = v),
                              validator: (v) =>
                                  v == null ? 'Select role' : null,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Checkbox(
                            value: _acceptedTerms,
                            onChanged: (v) =>
                                setState(() => _acceptedTerms = v ?? false),
                          ),
                          Expanded(
                            child: Wrap(
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                const Text(
                                  'I agree to ',
                                  style: TextStyle(color: BawaalColors.textMuted),
                                ),
                                GestureDetector(
                                  onTap: _openTerms,
                                  child: Text(
                                    'Terms and Conditions',
                                    style: GoogleFonts.archivo(
                                      color: BawaalColors.accent,
                                      fontWeight: FontWeight.w700,
                                      decoration: TextDecoration.underline,
                                      decorationColor: BawaalColors.accent,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      ElevatedButton(
                        onPressed: canContinue ? _submit : null,
                        child: _submitting
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('CONTINUE'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DropdownField<T> extends StatelessWidget {
  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    this.validator,
  });

  final String label;
  final T? value;
  final List<T> items;
  final ValueChanged<T?> onChanged;
  final String? Function(T?)? validator;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      key: ValueKey(value),
      initialValue: value,
      isExpanded: true,
      dropdownColor: BawaalColors.surface,
      decoration: InputDecoration(labelText: label),
      items: items
          .map(
            (item) => DropdownMenuItem<T>(
              value: item,
              child: Text(
                item.toString(),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          )
          .toList(),
      onChanged: onChanged,
      validator: validator,
    );
  }
}

class _SelectorField extends StatelessWidget {
  const _SelectorField({
    required this.label,
    required this.value,
    required this.placeholder,
    required this.onTap,
    this.validator,
  });

  final String label;
  final String? value;
  final String placeholder;
  final VoidCallback onTap;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return FormField<String>(
      validator: validator,
      builder: (state) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(12),
              child: InputDecorator(
                isEmpty: value == null,
                decoration: InputDecoration(
                  labelText: label,
                  errorText: state.errorText,
                  suffixIcon: const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: BawaalColors.textMuted,
                  ),
                ),
                child: Text(
                  value ?? placeholder,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: value == null
                        ? BawaalColors.textMuted
                        : BawaalColors.textPrimary,
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
