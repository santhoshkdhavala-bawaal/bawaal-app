import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../config/theme.dart';

class OtpModal extends StatefulWidget {
  const OtpModal({
    super.key,
    required this.email,
    required this.onVerify,
    required this.onResend,
  });

  final String email;
  final Future<String?> Function(String otp) onVerify;
  final Future<void> Function() onResend;

  static Future<bool?> show(
    BuildContext context, {
    required String email,
    required Future<String?> Function(String otp) onVerify,
    required Future<void> Function() onResend,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black.withValues(alpha: 0.85),
      builder: (_) => OtpModal(
        email: email,
        onVerify: onVerify,
        onResend: onResend,
      ),
    );
  }

  @override
  State<OtpModal> createState() => _OtpModalState();
}

class _OtpModalState extends State<OtpModal> {
  static const int _length = 6;
  late final List<TextEditingController> _controllers;
  late final List<FocusNode> _nodes;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(_length, (_) => TextEditingController());
    _nodes = List.generate(_length, (_) => FocusNode());
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final n in _nodes) {
      n.dispose();
    }
    super.dispose();
  }

  String get _code => _controllers.map((c) => c.text).join();

  Future<void> _submit() async {
    final code = _code;
    if (code.length != _length) {
      setState(() => _error = 'Enter the $_length-digit code.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final err = await widget.onVerify(code);
    if (!mounted) return;
    setState(() => _busy = false);
    if (err == null) {
      Navigator.of(context).pop(true);
    } else {
      setState(() => _error = err);
    }
  }

  Future<void> _resend() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.onResend();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('OTP resent. Check your email.')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: BawaalColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'VERIFY OTP',
              style: GoogleFonts.bebasNeue(
                fontSize: 30,
                letterSpacing: 1.4,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Enter the code sent to\n${widget.email}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: BawaalColors.textMuted,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: List.generate(_length, (i) {
                return SizedBox(
                  width: 42,
                  child: TextField(
                    controller: _controllers[i],
                    focusNode: _nodes[i],
                    enabled: !_busy,
                    textAlign: TextAlign.center,
                    keyboardType: TextInputType.number,
                    maxLength: 1,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: InputDecoration(
                      counterText: '',
                      filled: true,
                      fillColor: const Color(0xFF0A192F),
                      contentPadding: const EdgeInsets.symmetric(vertical: 12),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: BawaalColors.fieldBorder),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(
                          color: BawaalColors.accent,
                          width: 1.6,
                        ),
                      ),
                    ),
                    onChanged: (v) {
                      if (v.isNotEmpty && i < _length - 1) {
                        _nodes[i + 1].requestFocus();
                      } else if (v.isEmpty && i > 0) {
                        _nodes[i - 1].requestFocus();
                      }
                      if (_code.length == _length) {
                        // Manual submit only — do not auto-verify.
                      }
                    },
                  ),
                );
              }),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: BawaalColors.danger, fontSize: 13),
              ),
            ],
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('VERIFY'),
              ),
            ),
            TextButton(
              onPressed: _busy ? null : _resend,
              child: const Text(
                'Resend code',
                style: TextStyle(color: BawaalColors.accent),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
