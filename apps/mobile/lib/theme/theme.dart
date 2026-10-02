import 'dart:math' as math;

import 'package:flutter/material.dart';

// Material 3 Expressive on the site's indigo (#4f39f6). The values match the
// approved prototype, so the app and the site read as one product. This is the
// Question Bank's colour; other products recolour their space (`spaces/space.dart`).

const _font = 'RobotoFlex';

const _light = ColorScheme(
  brightness: Brightness.light,
  primary: Color(0xFF4F39F6),
  onPrimary: Color(0xFFFFFFFF),
  primaryContainer: Color(0xFFE3DFFF),
  onPrimaryContainer: Color(0xFF1A0A73),
  secondary: Color(0xFF5D5A72),
  onSecondary: Color(0xFFFFFFFF),
  secondaryContainer: Color(0xFFE4E0F5),
  onSecondaryContainer: Color(0xFF1C1A2C),
  tertiary: Color(0xFF8E3A5A),
  onTertiary: Color(0xFFFFFFFF),
  tertiaryContainer: Color(0xFFFFD9E3),
  onTertiaryContainer: Color(0xFF7A1F41),
  error: Color(0xFFBA1A1A),
  onError: Color(0xFFFFFFFF),
  errorContainer: Color(0xFFFFDAD6),
  onErrorContainer: Color(0xFF410002),
  surface: Color(0xFFFCF8FF),
  onSurface: Color(0xFF1C1B23),
  onSurfaceVariant: Color(0xFF48465A),
  surfaceContainerLowest: Color(0xFFFFFFFF),
  surfaceContainerLow: Color(0xFFF6F2FD),
  surfaceContainer: Color(0xFFF0ECF8),
  surfaceContainerHigh: Color(0xFFEAE6F3),
  surfaceContainerHighest: Color(0xFFE4E0EE),
  outline: Color(0xFF797689),
  outlineVariant: Color(0xFFCAC5DC),
  inverseSurface: Color(0xFF312F39),
  onInverseSurface: Color(0xFFF3EFFB),
  inversePrimary: Color(0xFFC5BFFF),
  shadow: Color(0xFF000000),
  scrim: Color(0xFF000000),
  surfaceTint: Color(0xFF4F39F6),
);

const _dark = ColorScheme(
  brightness: Brightness.dark,
  primary: Color(0xFFC5BFFF),
  onPrimary: Color(0xFF2A1CA3),
  primaryContainer: Color(0xFF3A27C7),
  onPrimaryContainer: Color(0xFFE3DFFF),
  secondary: Color(0xFFC8C3DC),
  onSecondary: Color(0xFF302E42),
  secondaryContainer: Color(0xFF45425A),
  onSecondaryContainer: Color(0xFFE4E0F5),
  tertiary: Color(0xFFFFB0C8),
  onTertiary: Color(0xFF561D32),
  tertiaryContainer: Color(0xFF6E2440),
  onTertiaryContainer: Color(0xFFFFD9E3),
  error: Color(0xFFFFB4AB),
  onError: Color(0xFF690005),
  errorContainer: Color(0xFF93000A),
  onErrorContainer: Color(0xFFFFDAD6),
  surface: Color(0xFF13121A),
  onSurface: Color(0xFFE5E1EE),
  onSurfaceVariant: Color(0xFFC9C5D8),
  surfaceContainerLowest: Color(0xFF0E0D14),
  surfaceContainerLow: Color(0xFF1B1A22),
  surfaceContainer: Color(0xFF1F1E27),
  surfaceContainerHigh: Color(0xFF2A2832),
  surfaceContainerHighest: Color(0xFF35333D),
  outline: Color(0xFF938FA4),
  outlineVariant: Color(0xFF48465A),
  inverseSurface: Color(0xFFE5E1EE),
  onInverseSurface: Color(0xFF312F39),
  inversePrimary: Color(0xFF4F39F6),
  shadow: Color(0xFF000000),
  scrim: Color(0xFF000000),
  surfaceTint: Color(0xFFC5BFFF),
);

/// Container and content colours for each exam type (see `exam_shape.dart`),
/// plus [changes], for papers a reviewer sent back (the website's sky blue).
@immutable
class ExamColors extends ThemeExtension<ExamColors> {
  const ExamColors({
    required this.finalExam,
    required this.midterm,
    required this.quiz,
    required this.lab,
    required this.changes,
  });

  final (Color, Color) finalExam;
  final (Color, Color) midterm;
  final (Color, Color) quiz;
  final (Color, Color) lab;
  final (Color, Color) changes;

  static const light = ExamColors(
    finalExam: (Color(0xFFE3DFFF), Color(0xFF2A1CA3)),
    midterm: (Color(0xFFFFD9E3), Color(0xFF7A1F41)),
    quiz: (Color(0xFFFFE08F), Color(0xFF5A4200)),
    lab: (Color(0xFFB9F0E3), Color(0xFF00493D)),
    changes: (Color(0xFFCFE5FF), Color(0xFF003355)),
  );

  static const dark = ExamColors(
    finalExam: (Color(0xFF3A2BA8), Color(0xFFE3DFFF)),
    midterm: (Color(0xFF6E2440), Color(0xFFFFD9E3)),
    quiz: (Color(0xFF5A4400), Color(0xFFFFE08F)),
    lab: (Color(0xFF005145), Color(0xFFB9F0E3)),
    changes: (Color(0xFF004A77), Color(0xFFCFE5FF)),
  );

  static ExamColors of(BuildContext context) =>
      Theme.of(context).extension<ExamColors>()!;

  @override
  ExamColors copyWith() => this;

  @override
  ExamColors lerp(ExamColors? other, double t) {
    if (other == null) return this;
    (Color, Color) mix((Color, Color) a, (Color, Color) b) =>
        (Color.lerp(a.$1, b.$1, t)!, Color.lerp(a.$2, b.$2, t)!);
    return ExamColors(
      finalExam: mix(finalExam, other.finalExam),
      midterm: mix(midterm, other.midterm),
      quiz: mix(quiz, other.quiz),
      lab: mix(lab, other.lab),
      changes: mix(changes, other.changes),
    );
  }
}

/// The wide, heavy display type of headings and department codes, from Roboto
/// Flex's width (`wdth`) and weight axes.
TextStyle expressive(
  double size, {
  double width = 130,
  double weight = 820,
  Color? color,
}) => TextStyle(
  fontFamily: _font,
  fontSize: size,
  height: 1.0,
  letterSpacing: size >= 28 ? -0.02 * size : 0,
  color: color,
  fontWeight: FontWeight.w800,
  fontVariations: [
    FontVariation('wdth', width),
    FontVariation('wght', weight),
    FontVariation('opsz', math.min(size, 144)),
  ],
);

ThemeData buildTheme(Brightness brightness) {
  final scheme = brightness == Brightness.light ? _light : _dark;
  final base = ThemeData(
    colorScheme: scheme,
    fontFamily: _font,
    extensions: [
      brightness == Brightness.light ? ExamColors.light : ExamColors.dark,
    ],
  );
  return base.copyWith(
    scaffoldBackgroundColor: scheme.surface,
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surface,
      foregroundColor: scheme.onSurface,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: scheme.surfaceContainer,
      indicatorColor: scheme.secondaryContainer,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontFamily: _font,
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
        ),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      side: BorderSide(color: scheme.outlineVariant),
      // With a colour: a style without one leaves chip labels white.
      labelStyle: TextStyle(
        fontWeight: FontWeight.w500,
        color: scheme.onSurfaceVariant,
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: scheme.surfaceContainerLow,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 24),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
