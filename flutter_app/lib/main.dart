import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config/env.dart';
import 'config/theme.dart';
import 'screens/registration_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await dotenv.load(fileName: '.env');
  } catch (_) {
    try {
      await dotenv.load(fileName: '.env.example');
    } catch (_) {}
  }

  if (AppEnv.isConfigured) {
    await Supabase.initialize(
      url: AppEnv.supabaseUrl,
      publishableKey: AppEnv.supabaseAnonKey,
      authOptions: const FlutterAuthClientOptions(detectSessionInUri: false),
    );
  }

  runApp(const BawaalApp());
}

/// Production entry — boots directly into the locked registration module.
class BawaalApp extends StatelessWidget {
  const BawaalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BAWAAL',
      debugShowCheckedModeBanner: false,
      theme: buildBawaalTheme(),
      home: const RegistrationPage(),
    );
  }
}
