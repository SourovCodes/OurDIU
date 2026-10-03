import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api.dart';
import '../api/generated/export.dart';
import 'prefs.dart';

// The Class Routine (docs/PLAN.md, decision 29): the live routine of CSE, the only
// department for now, and the section a student made theirs, kept on the phone so
// Today and Week work offline.

const routineDepartment = RoutineDepartmentSlug.cse;

/// Days of the university week, Saturday first.
const routineWeek = [
  RoutineDay.sat,
  RoutineDay.sun,
  RoutineDay.mon,
  RoutineDay.tue,
  RoutineDay.wed,
  RoutineDay.thu,
  RoutineDay.fri,
];

const _dayNames = {
  RoutineDay.sat: 'Saturday',
  RoutineDay.sun: 'Sunday',
  RoutineDay.mon: 'Monday',
  RoutineDay.tue: 'Tuesday',
  RoutineDay.wed: 'Wednesday',
  RoutineDay.thu: 'Thursday',
  RoutineDay.fri: 'Friday',
};

String dayName(RoutineDay day) => _dayNames[day] ?? '';
String shortDayName(RoutineDay day) => dayName(day).substring(0, 3);

/// Minutes since midnight of a 24-hour "HH:MM".
int minutesOf(String time) {
  final [h, m] = time.split(':').map(int.parse).toList();
  return h * 60 + m;
}

/// "1:00 pm" for "13:00".
String clockTime(String time) {
  final minutes = minutesOf(time);
  final h = minutes ~/ 60;
  final m = (minutes % 60).toString().padLeft(2, '0');
  return '${h % 12 == 0 ? 12 : h % 12}:$m ${h < 12 ? 'am' : 'pm'}';
}

/// "10:00 – 11:30 am", or "11:30 am – 1:00 pm" across noon.
String timeRange(String start, String end) {
  final a = clockTime(start);
  final b = clockTime(end);
  return a.substring(a.length - 2) == b.substring(b.length - 2)
      ? '${a.substring(0, a.length - 3)} – $b'
      : '$a – $b';
}

/// "67_B1" for lab group B1 of 67_B, as students write it.
String groupLabel(String section, String group) =>
    section.endsWith('_${group[0]}') && RegExp(r'^[A-Z]\d+$').hasMatch(group)
    ? '$section${group.substring(1)}'
    : '$section ($group)';

/// A batch's own section ("67_B"), not a retake section like "RE_A(3C)", which
/// gathers many courses at the same times.
bool isRegularSection(String section) =>
    RegExp(r'^\d+_[A-Za-z]+$').hasMatch(section);

/// The day and minute in Dhaka, where DIU's classes are (UTC+6, no summer time).
typedef DhakaNow = ({RoutineDay day, int minutes, DateTime date});

DhakaNow dhakaNow([DateTime? at]) {
  final t = (at ?? DateTime.now()).toUtc().add(const Duration(hours: 6));
  // DateTime.weekday: Monday 1 … Sunday 7; the university week starts Saturday.
  final day = routineWeek[(t.weekday + 1) % 7];
  return (
    day: day,
    minutes: t.hour * 60 + t.minute,
    date: DateTime.utc(t.year, t.month, t.day),
  );
}

/// The date of each day of this university week (Saturday to Friday) in Dhaka.
Map<RoutineDay, DateTime> weekDates(DhakaNow now) {
  final today = routineWeek.indexOf(now.day);
  return {
    for (final (i, day) in routineWeek.indexed)
      day: now.date.add(Duration(days: i - today)),
  };
}

/// Sat–Thu, and Friday only when there are classes on it.
List<RoutineDay> weekDays(List<RoutineClass> classes) => [
  for (final day in routineWeek)
    if (day != RoutineDay.fri || classes.any((c) => c.day == day)) day,
];

/// A lab group's classes: its own labs and the whole section's classes.
List<RoutineClass> classesFor(List<RoutineClass> classes, String? group) => [
  for (final c in classes)
    if (group == null || c.labGroup == null || c.labGroup == group) c,
];

bool isLab(RoutineClass c) =>
    c.labGroup != null || c.roomType == RoutineRoomType.lab;

enum ClassState { over, now, later }

ClassState? classState(RoutineClass c, DhakaNow now) {
  if (c.day != now.day) return null;
  if (now.minutes >= minutesOf(c.end)) return ClassState.over;
  if (now.minutes >= minutesOf(c.start)) return ClassState.now;
  return ClassState.later;
}

/// The next class to start after [now], this week or next, and how many days
/// ahead it is (0 today, 1 tomorrow, …).
({RoutineClass c, int daysAhead})? nextClass(
  List<RoutineClass> classes,
  DhakaNow now,
) {
  final today = routineWeek.indexOf(now.day);
  RoutineClass? best;
  var bestAhead = 0;
  for (final c in classes) {
    var ahead =
        ((routineWeek.indexOf(c.day) - today + 7) % 7) * 1440 +
        minutesOf(c.start) -
        now.minutes;
    if (ahead <= 0) ahead += 7 * 1440;
    if (best == null || ahead < bestAhead) {
      best = c;
      bestAhead = ahead;
    }
  }
  if (best == null) return null;
  return (c: best, daysAhead: (now.minutes + bestAhead) ~/ 1440);
}

/// "Today", "Tomorrow" or the day's name.
String dayWord(RoutineDay day, int daysAhead) => switch (daysAhead) {
  0 => 'Today',
  1 => 'Tomorrow',
  _ => dayName(day),
};

/// A section to show, and maybe one of its lab groups.
typedef RoutinePick = ({String section, String? group});

String pickLabel(RoutinePick pick) =>
    pick.group == null ? pick.section : groupLabel(pick.section, pick.group!);

/// The PDF of a section's week (`GET /api/v1/routine/…/pdf`).
Uri routinePdfUrl(RoutinePick pick) => Uri.parse(apiBaseUrl).replace(
  path:
      '/api/v1/routine/${routineDepartment.json}/sections/${pick.section}/pdf',
  queryParameters: pick.group == null ? null : {'group': pick.group},
);

/// The section's page on the website, for sharing.
Uri routinePageUrl(RoutinePick pick) => Uri.parse(apiBaseUrl).replace(
  path: '/routine/${routineDepartment.json}/${pick.section}',
  queryParameters: pick.group == null ? null : {'group': pick.group},
);

/// Whether a request failed because there's no live routine (or no such section).
bool isMissing(Object error) =>
    error is DioException && error.response?.statusCode == 404;

/// Riverpod retries failed providers; a 404 (no routine, no such section) won't
/// change by retrying.
Duration? _retry(int count, Object error) => isMissing(error) || count >= 3
    ? null
    : Duration(milliseconds: 500 * (1 << count));

/// Every section of the live routine, for finding yours. A 404: no routine yet.
final routineSectionsProvider = FutureProvider<RoutineSectionList>(
  (ref) => ref
      .watch(qbApiProvider)
      .routine
      .getApiV1RoutineDepartmentSections(department: routineDepartment),
  retry: _retry,
);

/// One section's week, from the network.
final routineSectionProvider = FutureProvider.family<RoutineSection, String>(
  (ref, section) => ref
      .watch(qbApiProvider)
      .routine
      .getApiV1RoutineDepartmentSectionsSection(
        department: routineDepartment,
        section: section,
      ),
  retry: _retry,
);

const _pickKey = 'routine_section';
const _groupKey = 'routine_group';
const _cacheKey = 'routine_cache';

/// The section the student made theirs ("My section"), kept on the phone.
class MySection extends Notifier<RoutinePick?> {
  @override
  RoutinePick? build() {
    final prefs = ref.watch(prefsProvider);
    final section = prefs.getString(_pickKey);
    return section == null
        ? null
        : (section: section, group: prefs.getString(_groupKey));
  }

  void set(RoutinePick? pick) {
    final prefs = ref.read(prefsProvider);
    state = pick;
    if (pick == null) {
      prefs
        ..remove(_pickKey)
        ..remove(_groupKey)
        ..remove(_cacheKey);
    } else {
      prefs.setString(_pickKey, pick.section);
      if (pick.group == null) {
        prefs.remove(_groupKey);
      } else {
        prefs.setString(_groupKey, pick.group!);
      }
    }
  }
}

final mySectionProvider = NotifierProvider<MySection, RoutinePick?>(
  MySection.new,
);

/// My section's week: fresh from the network when there is one, else the copy
/// kept from last time ([offline]). [updatedFrom] is the version the phone had
/// before, when the routine changed since.
typedef MyRoutine = ({
  RoutineSection routine,
  RoutinePick pick,
  bool offline,
  String? updatedFrom,
});

final myRoutineProvider = FutureProvider<MyRoutine?>(retry: _retry, (
  ref,
) async {
  final pick = ref.watch(mySectionProvider);
  if (pick == null) return null;
  final prefs = ref.read(prefsProvider);
  RoutineSection? cached;
  try {
    final json = prefs.getString(_cacheKey);
    if (json != null) {
      final copy = RoutineSection.fromJson(
        jsonDecode(json) as Map<String, Object?>,
      );
      if (copy.section == pick.section) cached = copy;
    }
  } on Object {
    // An old or broken copy: fetched again below.
  }
  try {
    final routine = await ref.watch(
      routineSectionProvider(pick.section).future,
    );
    await prefs.setString(_cacheKey, jsonEncode(routine.toJson()));
    final before = cached?.version.version;
    return (
      routine: routine,
      pick: pick,
      offline: false,
      updatedFrom: before != null && before != routine.version.version
          ? before
          : null,
    );
  } on Object catch (error) {
    // Offline: last time's copy. Gone from a new routine (404): say so.
    if (cached != null && !isMissing(error)) {
      return (routine: cached, pick: pick, offline: true, updatedFrom: null);
    }
    rethrow;
  }
});

/// One choice in the section search: a section, or one of its lab groups.
typedef SectionChoice = ({
  String section,
  String? group,
  String label,
  int classCount,
});

List<SectionChoice> sectionChoices(List<RoutineSectionSummary> sections) => [
  for (final s in sections) ...[
    (
      section: s.section,
      group: null,
      label: s.section,
      classCount: s.classCount,
    ),
    for (final g in s.labGroups)
      (
        section: s.section,
        group: g,
        label: groupLabel(s.section, g),
        classCount: s.classCount,
      ),
  ],
];

String _squash(String text) =>
    text.toUpperCase().replaceAll(RegExp(r'[\s_-]+'), '');

/// Choices matching what was typed, ignoring case, spaces and underscores ("67b",
/// "67 B1"): those starting with it first.
List<SectionChoice> matchSections(
  List<SectionChoice> choices,
  String query, {
  int limit = 30,
}) {
  final q = _squash(query);
  if (q.isEmpty) return const [];
  final starts = <SectionChoice>[];
  final contains = <SectionChoice>[];
  for (final c in choices) {
    final label = _squash(c.label);
    if (label.startsWith(q)) {
      starts.add(c);
    } else if (label.contains(q)) {
      contains.add(c);
    }
  }
  return [...starts, ...contains].take(limit).toList();
}

/// Sections by batch, newest batch first; retakes and others last.
List<({String batch, List<String> sections})> sectionsByBatch(
  List<RoutineSectionSummary> sections,
) {
  final batches = <String, List<String>>{};
  for (final s in sections) {
    final batch = RegExp(r'^(\d+)_').firstMatch(s.section)?.group(1) ?? '';
    (batches[batch] ??= []).add(s.section);
  }
  final keys = batches.keys.toList()
    ..sort(
      (a, b) => a.isEmpty
          ? 1
          : b.isEmpty
          ? -1
          : int.parse(b).compareTo(int.parse(a)),
    );
  return [for (final k in keys) (batch: k, sections: batches[k]!)];
}
