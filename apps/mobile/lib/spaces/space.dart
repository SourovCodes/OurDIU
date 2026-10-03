import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/prefs.dart';
import '../theme/exam_shape.dart';

/// The OurDIU products. Each is a space of its own, with its own screens, tabs
/// and colour; none shows another's data. The switcher moves between them.
enum Space {
  questions(
    label: 'Question Bank',
    title: 'Question papers',
    tagline: 'Past quiz, midterm and final papers',
    icon: Icons.description_outlined,
    home: '/home',
    live: true,
    shape: ExamKind.finalExam,
    light: SpaceColors(
      accent: Color(0xFF4F39F6),
      container: Color(0xFFE3DFFF),
      onContainer: Color(0xFF1A0A73),
    ),
    dark: SpaceColors(
      accent: Color(0xFFC5BFFF),
      container: Color(0xFF3A27C7),
      onContainer: Color(0xFFE3DFFF),
    ),
  ),
  routine(
    label: 'Class Routine',
    title: 'My class routine',
    tagline: "Today's classes, your week, free rooms",
    icon: Icons.calendar_month_outlined,
    home: '/routine',
    live: false,
    shape: ExamKind.midterm,
    light: SpaceColors(
      accent: Color(0xFF006B5B),
      container: Color(0xFFB9F0E3),
      onContainer: Color(0xFF00382F),
    ),
    dark: SpaceColors(
      accent: Color(0xFF80D5C4),
      container: Color(0xFF005145),
      onContainer: Color(0xFFB9F0E3),
    ),
  ),
  market(
    label: 'Marketplace',
    title: 'Marketplace',
    tagline: 'Buy and sell with DIU students',
    icon: Icons.shopping_bag_outlined,
    home: '/market',
    live: false,
    shape: ExamKind.quiz,
    light: SpaceColors(
      accent: Color(0xFF8E3A5A),
      container: Color(0xFFFFD9E3),
      onContainer: Color(0xFF5C1530),
    ),
    dark: SpaceColors(
      accent: Color(0xFFFFB0C8),
      container: Color(0xFF6E2440),
      onContainer: Color(0xFFFFD9E3),
    ),
  );

  const Space({
    required this.label,
    required this.title,
    required this.tagline,
    required this.icon,
    required this.home,
    required this.live,
    required this.shape,
    required this.light,
    required this.dark,
  });

  /// The product's name, at the top of its space and in the switcher.
  final String label;

  /// What the first-launch chooser calls it.
  final String title;
  final String tagline;
  final IconData icon;

  /// The space's first screen.
  final String home;

  /// False while it's "coming soon".
  final bool live;

  /// Drawn behind its icon, like the exam types' shapes.
  final ExamKind shape;
  final SpaceColors light;
  final SpaceColors dark;

  SpaceColors colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.light ? light : dark;

  /// The app's theme with this space's colour as the primary one.
  ThemeData theme(BuildContext context) {
    final base = Theme.of(context);
    final c = colors(context);
    final light = base.brightness == Brightness.light;
    return base.copyWith(
      colorScheme: base.colorScheme.copyWith(
        primary: c.accent,
        onPrimary: light ? Colors.white : c.container,
        primaryContainer: c.container,
        onPrimaryContainer: c.onContainer,
        secondaryContainer: c.container,
        onSecondaryContainer: c.onContainer,
        surfaceTint: c.accent,
      ),
      // The base theme fixes the tab indicator's colour; a space's tabs take its own.
      navigationBarTheme: base.navigationBarTheme.copyWith(
        indicatorColor: c.container,
      ),
    );
  }
}

@immutable
class SpaceColors {
  const SpaceColors({
    required this.accent,
    required this.container,
    required this.onContainer,
  });

  final Color accent;
  final Color container;
  final Color onContainer;
}

const _key = 'space';

Space? _read(SharedPreferences prefs) =>
    Space.values.where((s) => s.name == prefs.getString(_key)).firstOrNull;

/// Whether the first launch asks "What do you need?". Not until a second product
/// is live (like the website's `HUB_LIVE`): until then the app opens in the
/// Question Bank. Set to true when the Class Routine or the Marketplace launches.
const showChooser = false;

/// Where the app opens: the space used last, or the chooser on first launch. While
/// the chooser is off, a coming-soon space picked from the switcher isn't where to
/// land either: the app opens in the Question Bank.
String startLocation(SharedPreferences prefs) {
  final last = _read(prefs);
  if (showChooser) return last?.home ?? '/choose';
  return last != null && last.live ? last.home : Space.questions.home;
}

/// The space used last, remembered so the app reopens there.
class LastSpace extends Notifier<Space?> {
  @override
  Space? build() => _read(ref.watch(prefsProvider));

  void set(Space space) {
    state = space;
    ref.read(prefsProvider).setString(_key, space.name);
  }
}

final lastSpaceProvider = NotifierProvider<LastSpace, Space?>(LastSpace.new);
