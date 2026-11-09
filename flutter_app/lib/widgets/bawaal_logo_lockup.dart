import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../config/theme.dart';

/// Locked registration header: BAWAAL.png + spaced orange tagline.
class BawaalLogoLockup extends StatelessWidget {
  const BawaalLogoLockup({
    super.key,
    this.height = 72,
  });

  final double height;

  static const String logoAsset = 'assets/images/BAWAAL.png';

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'BAWAAL — Own Your Chaos',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset(
            'assets/images/BAWAAL.png',
            height: height,
            fit: BoxFit.contain,
            filterQuality: FilterQuality.high,
            errorBuilder: (context, error, stackTrace) => Text(
              'BAWAAL',
              style: GoogleFonts.bebasNeue(
                fontSize: 36,
                color: BawaalColors.accent,
                letterSpacing: 2,
                height: 1,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'O W N   Y O U R   C H A O S',
            textAlign: TextAlign.center,
            style: GoogleFonts.archivo(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 2.4,
              color: BawaalColors.accent,
            ),
          ),
        ],
      ),
    );
  }
}
