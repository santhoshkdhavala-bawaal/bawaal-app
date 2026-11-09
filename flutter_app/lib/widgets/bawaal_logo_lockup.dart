import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../config/theme.dart';

class BawaalLogoLockup extends StatelessWidget {
  const BawaalLogoLockup({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Image.asset(
              'assets/brand/bawaal_b_solo.png',
              height: 54,
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) => Text(
                'B',
                style: GoogleFonts.bebasNeue(
                  fontSize: 48,
                  color: Colors.white,
                  height: 1,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              'BAWAAL',
              style: GoogleFonts.bebasNeue(
                fontSize: 42,
                color: Colors.white,
                letterSpacing: 2.4,
                height: 1,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          'OWN YOUR CHAOS',
          style: GoogleFonts.archivo(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 3.2,
            color: BawaalColors.accent,
          ),
        ),
      ],
    );
  }
}
