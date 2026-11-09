import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config/env.dart';
import 'config/theme.dart';
import 'screens/registration_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Prefer local `.env` (gitignored). Falls back to `--dart-define`.
  try {
    await dotenv.load(fileName: '.env');
  } catch (_) {
    try {
      await dotenv.load(fileName: '.env.example');
    } catch (_) {
      // Env may still come from --dart-define=SUPABASE_URL / SUPABASE_ANON_KEY
    }
  }

  if (AppEnv.isConfigured) {
    await Supabase.initialize(
      url: AppEnv.supabaseUrl,
      publishableKey: AppEnv.supabaseAnonKey,
    );
  }

  runApp(const BawaalApp());
}

class BawaalApp extends StatelessWidget {
  const BawaalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BAWAAL',
      debugShowCheckedModeBanner: false,
      theme: buildBawaalTheme(),
      home: AppEnv.isConfigured
          ? const RegistrationPage()
          : const _MissingEnvScreen(),
    );
  }
}

class _MissingEnvScreen extends StatelessWidget {
  const _MissingEnvScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: BawaalColors.background,
      body: Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Add SUPABASE_URL and SUPABASE_ANON_KEY to flutter_app/.env '
            '(copy from .env.example), then restart.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70, height: 1.4),
          ),
        ),
      ),
    );
  }
}
