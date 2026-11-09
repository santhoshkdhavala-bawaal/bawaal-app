import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../config/theme.dart';

/// Locked BAWAAL logo lockup for dark registration surfaces.
///
/// Primary asset: stacked B + BAWAAL + OWN YOUR CHAOS (`BAWAALFULL.png`).
class BawaalLogoLockup extends StatelessWidget {
  const BawaalLogoLockup({
    super.key,
    this.height = 80,
  });

  /// Visual height of the full lockup on dark (#0E0F13) surfaces.
  final double height;

  static const String fullLockupAsset = 'assets/images/BAWAALFULL.png';

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'BAWAAL — Own Your Chaos',
      image: true,
      child: Center(
        child: Image.asset(
          'assets/images/BAWAALFULL.png',
          height: height,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.high,
          errorBuilder: (context, error, stackTrace) => _FallbackLockup(
            height: height,
          ),
        ),
      ),
    );
  }
}

class _FallbackLockup extends StatelessWidget {
  const _FallbackLockup({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            'BAWAAL',
            style: GoogleFonts.bebasNeue(
              fontSize: height * 0.28,
              color: BawaalColors.accent,
              letterSpacing: 2.4,
              height: 1,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'OWN YOUR CHAOS',
            style: GoogleFonts.archivo(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 3.2,
              color: BawaalColors.accent,
            ),
          ),
        ],
      ),
    );
  }
}
