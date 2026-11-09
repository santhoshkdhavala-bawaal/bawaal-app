import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../config/theme.dart';
import '../widgets/bawaal_logo_lockup.dart';

class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key, this.onAgree});

  final VoidCallback? onAgree;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BawaalColors.background,
      appBar: AppBar(
        backgroundColor: BawaalColors.background,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'TERMS',
          style: GoogleFonts.bebasNeue(fontSize: 24, letterSpacing: 1.2),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: BawaalColors.surface,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const BawaalLogoLockup(),
                      const SizedBox(height: 16),
                      Text(
                        'Arena Philosophy & Terms of Service',
                        style: GoogleFonts.archivo(
                          color: BawaalColors.textMuted,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 18),
                      _section(
                        'THE BAWAAL PHILOSOPHY',
                        'BAWAAL is built to discover, empower, and showcase athletic talent. '
                        'We stand for pure sportsmanship, mutual respect, and raw athletic grit. '
                        'No hate, no politics—just pure sports.',
                      ),
                      _section(
                        'PERSONAL LIABILITY NOTICE',
                        'You are entirely and solely responsible for your actions, uploads, '
                        'comments, and interactions on this platform. BAWAAL is not responsible '
                        'for your conduct or content.',
                      ),
                      _section(
                        '1. BRAND & IDENTITY PROTECTION',
                        'The BAWAAL name, logo, design assets, and visual identity are protected. '
                        'Unauthorized commercial use is prohibited.',
                      ),
                      _section(
                        '2. ATHLETE SAFETY & COMBAT CONDUCT',
                        'Combat and sparring content must follow sportsmanship rules. '
                        'Reckless violence or intentional injury results in permanent ban.',
                      ),
                      _section(
                        '3. INTELLECTUAL PROPERTY & UPLOADS',
                        'By uploading media you confirm you hold the rights and grant BAWAAL '
                        'a non-exclusive license to showcase your talent.',
                      ),
                      _section(
                        '4. DATA PRIVACY',
                        'Profile and emergency contact data is used only to operate BAWAAL '
                        'services and safety features.',
                      ),
                      _section(
                        '5. ACCOUNT TERMINATION',
                        'BAWAAL may suspend or ban accounts for hate speech, harassment, '
                        'fake records, or arena decorum violations.',
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    onAgree?.call();
                    Navigator.of(context).pop(true);
                  },
                  child: const Text('I AGREE'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _section(String title, String body) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.archivo(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 14,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            body,
            style: const TextStyle(
              color: BawaalColors.textMuted,
              height: 1.45,
              fontSize: 13.5,
            ),
          ),
          const SizedBox(height: 12),
          const Divider(color: Colors.white12, height: 1),
        ],
      ),
    );
  }
}
