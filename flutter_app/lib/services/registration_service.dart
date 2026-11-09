import 'dart:math';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/registration_data.dart';

class RegistrationResult {
  const RegistrationResult({
    required this.ok,
    this.userId,
    this.errorMessage,
    this.needsEmailOtp = false,
  });

  final bool ok;
  final String? userId;
  final String? errorMessage;
  final bool needsEmailOtp;
}

class RegistrationService {
  RegistrationService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  /// Creates auth user via [signUp], upserts `public.profiles`, then expects OTP.
  Future<RegistrationResult> register(RegistrationData data) async {
    try {
      final password = _securePassword();
      final authResponse = await _client.auth.signUp(
        email: data.email.trim(),
        password: password,
        data: {
          'username': data.userName.trim(),
          'real_name': data.realName.trim(),
          'role': data.role.toLowerCase(),
          'sport': data.sport,
        },
      );

      final user = authResponse.user;
      if (user == null) {
        return const RegistrationResult(
          ok: false,
          errorMessage: 'Sign up failed — no user returned.',
        );
      }

      await _upsertProfile(data, user.id);

      // Always surface OTP modal after signUp (email confirmations / verify step).
      return RegistrationResult(
        ok: true,
        userId: user.id,
        needsEmailOtp: true,
      );
    } on AuthException catch (e) {
      return RegistrationResult(ok: false, errorMessage: e.message);
    } catch (e) {
      return RegistrationResult(ok: false, errorMessage: e.toString());
    }
  }

  Future<RegistrationResult> verifyEmailOtp({
    required String email,
    required String token,
    required RegistrationData data,
  }) async {
    try {
      final response = await _client.auth.verifyOTP(
        type: OtpType.signup,
        email: email.trim(),
        token: token.trim(),
      );

      final user = response.user ?? _client.auth.currentUser;
      if (user == null) {
        return const RegistrationResult(
          ok: false,
          errorMessage: 'OTP verified but session user is missing.',
        );
      }

      await _upsertProfile(data, user.id);
      return RegistrationResult(ok: true, userId: user.id);
    } on AuthException catch (e) {
      return RegistrationResult(ok: false, errorMessage: e.message);
    } catch (e) {
      return RegistrationResult(ok: false, errorMessage: e.toString());
    }
  }

  Future<void> resendSignupOtp(String email) async {
    await _client.auth.resend(
      type: OtpType.signup,
      email: email.trim(),
    );
  }

  Future<void> _upsertProfile(RegistrationData data, String userId) async {
    final full = data.toProfileRow(userId);
    try {
      await _client.from('profiles').upsert(full, onConflict: 'id');
    } catch (_) {
      // Soft-fallback when optional columns are missing from schema cache.
      await _client
          .from('profiles')
          .upsert(data.toSlimProfileRow(userId), onConflict: 'id');
    }
  }

  String _securePassword() {
    const chars =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#\$%^&*';
    final rng = Random.secure();
    return List.generate(24, (_) => chars[rng.nextInt(chars.length)]).join();
  }
}
