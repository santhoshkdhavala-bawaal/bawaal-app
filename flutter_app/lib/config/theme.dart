import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// BAWAAL registration visual tokens (wireframe).
abstract final class BawaalColors {
  static const Color background = Color(0xFF0E0F13);
  static const Color surface = Color(0xFF1E1F23);
  static const Color accent = Color(0xFFF36017);
  static const Color button = Color(0xFFF36017);
  static const Color textPrimary = Color(0xFFF5F5F5);
  static const Color textMuted = Color(0xFF9CA3AF);
  static const Color fieldBorder = Color(0xFF2A2B31);
  static const Color danger = Color(0xFFEF4444);
  static const Color success = Color(0xFF22C55E);
}

ThemeData buildBawaalTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: BawaalColors.background,
    colorScheme: const ColorScheme.dark(
      primary: BawaalColors.accent,
      secondary: BawaalColors.accent,
      surface: BawaalColors.surface,
      error: BawaalColors.danger,
    ),
  );

  final display = GoogleFonts.bebasNeueTextTheme(base.textTheme);
  final body = GoogleFonts.archivoTextTheme(base.textTheme);

  return base.copyWith(
    textTheme: body.copyWith(
      displayLarge: display.displayLarge?.copyWith(
        color: BawaalColors.textPrimary,
        letterSpacing: 1.2,
      ),
      displayMedium: display.displayMedium?.copyWith(
        color: BawaalColors.textPrimary,
        letterSpacing: 1.1,
      ),
      headlineLarge: display.headlineLarge?.copyWith(
        color: BawaalColors.textPrimary,
        letterSpacing: 1.4,
      ),
      headlineMedium: display.headlineMedium?.copyWith(
        color: BawaalColors.textPrimary,
        letterSpacing: 1.2,
      ),
      titleLarge: body.titleLarge?.copyWith(
        color: BawaalColors.textPrimary,
        fontWeight: FontWeight.w700,
      ),
      bodyLarge: body.bodyLarge?.copyWith(color: BawaalColors.textPrimary),
      bodyMedium: body.bodyMedium?.copyWith(color: BawaalColors.textMuted),
      labelLarge: body.labelLarge?.copyWith(
        color: BawaalColors.textPrimary,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.6,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: BawaalColors.surface,
      hintStyle: const TextStyle(color: BawaalColors.textMuted),
      labelStyle: const TextStyle(color: BawaalColors.textMuted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: BawaalColors.fieldBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: BawaalColors.fieldBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: BawaalColors.accent, width: 1.6),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: BawaalColors.danger),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: BawaalColors.danger, width: 1.6),
      ),
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return BawaalColors.accent;
        return Colors.transparent;
      }),
      checkColor: WidgetStateProperty.all(Colors.white),
      side: const BorderSide(color: BawaalColors.textMuted, width: 1.4),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: BawaalColors.button,
        foregroundColor: Colors.white,
        disabledBackgroundColor: BawaalColors.button.withValues(alpha: 0.35),
        disabledForegroundColor: Colors.white70,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: GoogleFonts.archivo(
          fontWeight: FontWeight.w800,
          fontSize: 16,
          letterSpacing: 0.8,
        ),
      ),
    ),
  );
}
