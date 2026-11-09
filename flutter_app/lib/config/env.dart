import 'package:flutter_dotenv/flutter_dotenv.dart';

abstract final class AppEnv {
  static String get supabaseUrl =>
      dotenv.maybeGet('SUPABASE_URL')?.trim() ??
      const String.fromEnvironment('SUPABASE_URL');

  static String get supabaseAnonKey =>
      dotenv.maybeGet('SUPABASE_ANON_KEY')?.trim() ??
      const String.fromEnvironment('SUPABASE_ANON_KEY');

  static bool get isConfigured =>
      supabaseUrl.isNotEmpty &&
      supabaseAnonKey.isNotEmpty &&
      !supabaseUrl.contains('YOUR_PROJECT_REF') &&
      supabaseAnonKey != 'your_anon_or_publishable_key';
}
