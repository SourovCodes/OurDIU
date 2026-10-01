import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'prefs.dart';

/// System, light or dark, from Account → Appearance.
class AppearanceSetting extends Notifier<ThemeMode> {
  static const _key = 'theme_mode';

  @override
  ThemeMode build() => ThemeMode.values.firstWhere(
    (mode) => mode.name == ref.watch(prefsProvider).getString(_key),
    orElse: () => ThemeMode.system,
  );

  void set(ThemeMode mode) {
    state = mode;
    ref.read(prefsProvider).setString(_key, mode.name);
  }
}

final appearanceProvider = NotifierProvider<AppearanceSetting, ThemeMode>(
  AppearanceSetting.new,
);

/// Courses opened from search, most recent first (up to 5), shown as shortcuts.
class RecentCourses extends Notifier<List<int>> {
  static const _key = 'recent_course_ids';

  @override
  List<int> build() => [
    for (final id in ref.watch(prefsProvider).getStringList(_key) ?? const [])
      ?int.tryParse(id),
  ];

  void add(int courseId) {
    state = [courseId, ...state.where((id) => id != courseId)].take(5).toList();
    ref.read(prefsProvider).setStringList(_key, [
      for (final id in state) '$id',
    ]);
  }
}

final recentCoursesProvider = NotifierProvider<RecentCourses, List<int>>(
  RecentCourses.new,
);
