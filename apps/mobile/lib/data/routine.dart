import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api.dart';
import '../api/generated/export.dart';
import 'prefs.dart';

// The Class Routine (docs/PLAN.md, decisions 29, 33 and 34): each department's live
// routine (CSE and EEE), its sections and teachers, and the section or teacher's
// week someone made theirs, kept on the phone so Today works offline.

/// The departments with a routine, in the order the app shows them.
const routineDepartments = [
  RoutineDepartmentSlug.cse,
  RoutineDepartmentSlug.eee,
];

/// "CSE" for [RoutineDepartmentSlug.cse].
String departmentName(RoutineDepartmentSlug d) => d.json!.toUpperCase();

RoutineDepartmentSlug? departmentFrom(String? json) =>
    routineDepartments.where((d) => d.json == json).firstOrNull;

/// The department a routine version is of, as in addresses.
RoutineDepartmentSlug departmentOf(RoutineVersion v) =>
    departmentFrom(v.department.json?.toLowerCase()) ??
    RoutineDepartmentSlug.cse;

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

/// "67_B1" for lab group B1 of 67_B (EEE's "1-2 B1" of 1-2 B), as students
/// write it.
String groupLabel(String section, String group) =>
    (section.endsWith('_${group[0]}') || section.endsWith(' ${group[0]}')) &&
        RegExp(r'^[A-Z]\d+$').hasMatch(group)
    ? '$section${group.substring(1)}'
    : '$section ($group)';

/// A batch's (or EEE level-term's) own section ("67_B", "1-2 B"), not a retake
/// section like "RE_A(3C)", which gathers many courses at the same times.
bool isRegularSection(String section) =>
    RegExp(r'^(?:\d+_[A-Za-z]+|\d-\d [A-Z]+)$').hasMatch(section);

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

/// What Today shows: the class in its card (the one on now, else the next one
/// today) and the list under it (the rest of today; once today's are over, or
/// on a day off, the next class day's). Nothing appears in both.
typedef TodayPlan = ({
  ({RoutineClass c, bool on})? focus,

  /// "Done for today" (true) or "No classes today" (false) when there's no
  /// class for the card; null when there is.
  bool? done,
  ({String heading, List<RoutineClass> classes})? list,
});

TodayPlan todayPlan(List<RoutineClass> classes, DhakaNow now) {
  final todays = [
    for (final c in classes)
      if (c.day == now.day) c,
  ];
  final current = todays
      .where((c) => classState(c, now) == ClassState.now)
      .firstOrNull;
  final later = [
    for (final c in todays)
      if (classState(c, now) == ClassState.later) c,
  ];
  final focus = current != null
      ? (c: current, on: true)
      : later.isNotEmpty
      ? (c: later.first, on: false)
      : null;
  if (focus != null) {
    final rest = [
      for (final c in later)
        if (!identical(c, focus.c)) c,
    ];
    return (
      focus: focus,
      done: null,
      list: rest.isEmpty ? null : (heading: 'Later today', classes: rest),
    );
  }
  final next = nextClass(classes, now);
  return (
    focus: null,
    done: todays.isNotEmpty,
    list: next == null
        ? null
        : (
            heading: next.daysAhead == 1
                ? 'Tomorrow, ${dayName(next.c.day)}'
                : dayWord(next.c.day, next.daysAhead),
            classes: [
              for (final c in classes)
                if (c.day == next.c.day) c,
            ],
          ),
  );
}

/// A section to show, and maybe one of its lab groups.
typedef RoutinePick = ({
  RoutineDepartmentSlug department,
  String section,
  String? group,
});

/// "67_B1": a section with its lab group, as students write it.
String pickLabel(String section, String? group) =>
    group == null ? section : groupLabel(section, group);

/// The PDF of a section's week (`GET /api/v1/routine/…/pdf`).
Uri routinePdfUrl(RoutinePick pick) => Uri.parse(apiBaseUrl).replace(
  path: '/api/v1/routine/${pick.department.json}/sections/${pick.section}/pdf',
  queryParameters: pick.group == null ? null : {'group': pick.group},
);

/// The section's page on the website, for sharing; EEE's "1-2 B" is "1-2_B".
Uri routinePageUrl(RoutinePick pick) => Uri.parse(apiBaseUrl).replace(
  path: '/routine/${pick.department.json}/${pick.section.replaceAll(' ', '_')}',
  queryParameters: pick.group == null ? null : {'group': pick.group},
);

/// A teacher's week to show: their department and initials as printed.
typedef TeacherPick = ({RoutineDepartmentSlug department, String initials});

/// The PDF of a teacher's week.
Uri teacherPdfUrl(TeacherPick pick) => Uri.parse(apiBaseUrl).replace(
  path: '/api/v1/routine/${pick.department.json}/teachers/${pick.initials}/pdf',
);

/// The teacher's page on the website, for sharing.
Uri teacherPageUrl(TeacherPick pick) => Uri.parse(
  apiBaseUrl,
).replace(path: '/routine/${pick.department.json}/teachers/${pick.initials}');

/// A teacher's name, or their initials until admins add it.
String teacherName(String initials, String? name) => name ?? initials;

/// Who attends a teacher's class, as students write them: "67_B1, 67_C".
String attendingLabel(List<RoutineAttendingSection> sections) => [
  for (final s in sections)
    s.labGroup == null ? s.section : groupLabel(s.section, s.labGroup!),
].join(', ');

/// A teacher's class in a section's class's shape, so the same tiles, cards and
/// sheets show it: no teacher, and the sections attending it instead. A lab
/// group's class is a lab.
class AttendedClass extends RoutineClass {
  AttendedClass(RoutineTeacherClass c)
    : sections = c.sections,
      super(
        day: c.day,
        start: c.start,
        end: c.end,
        course: c.course,
        labGroup: null,
        room: c.room,
        roomType:
            c.roomType ??
            (c.sections.any((s) => s.labGroup != null)
                ? RoutineRoomType.lab
                : null),
        teacher: null,
      );

  final List<RoutineAttendingSection> sections;
}

/// Whether a request failed because there's no live routine (or no such section).
bool isMissing(Object error) =>
    error is DioException && error.response?.statusCode == 404;

/// Riverpod retries failed providers; a 404 (no routine, no such section) won't
/// change by retrying.
Duration? _retry(int count, Object error) => isMissing(error) || count >= 3
    ? null
    : Duration(milliseconds: 500 * (1 << count));

/// A department's sections, for finding yours. A 404: no routine there yet.
final routineSectionsProvider =
    FutureProvider.family<RoutineSectionList, RoutineDepartmentSlug>(
      (ref, department) => ref
          .watch(qbApiProvider)
          .routine
          .getApiV1RoutineDepartmentSections(department: department),
      retry: _retry,
    );

/// The departments with a live routine; none means the space is coming soon.
final liveDepartmentsProvider = FutureProvider<List<RoutineDepartmentSlug>>((
  ref,
) async {
  final live = <RoutineDepartmentSlug>[];
  for (final d in routineDepartments) {
    try {
      await ref.watch(routineSectionsProvider(d).future);
      live.add(d);
    } on Object catch (error) {
      if (!isMissing(error)) rethrow;
    }
  }
  return live;
});

/// One section's week, from the network.
final routineSectionProvider =
    FutureProvider.family<
      RoutineSection,
      ({RoutineDepartmentSlug department, String section})
    >(
      (ref, of) => ref
          .watch(qbApiProvider)
          .routine
          .getApiV1RoutineDepartmentSectionsSection(
            department: of.department,
            section: of.section,
          ),
      retry: _retry,
    );

/// A department's teachers, for finding one's week.
final routineTeachersProvider =
    FutureProvider.family<RoutineTeacherList, RoutineDepartmentSlug>(
      (ref, department) => ref
          .watch(qbApiProvider)
          .routine
          .getApiV1RoutineDepartmentTeachers(department: department),
      retry: _retry,
    );

/// One teacher's week, from the network.
final routineTeacherProvider =
    FutureProvider.family<RoutineTeacherWeek, TeacherPick>(
      (ref, pick) => ref
          .watch(qbApiProvider)
          .routine
          .getApiV1RoutineDepartmentTeachersInitials(
            department: pick.department,
            initials: pick.initials,
          ),
      retry: _retry,
    );

const _departmentKey = 'routine_department';
const _pickKey = 'routine_section';
const _groupKey = 'routine_group';
const _teacherKey = 'routine_teacher';
const _cacheKey = 'routine_cache';
const _teacherCacheKey = 'routine_teacher_cache';
const _browseKey = 'routine_browse_department';

/// What someone made theirs: a section (maybe one lab group) or a teacher's week.
sealed class SavedRoutine {
  const SavedRoutine(this.department);

  final RoutineDepartmentSlug department;
}

class SavedSection extends SavedRoutine {
  const SavedSection(super.department, this.section, this.group);

  final String section;
  final String? group;

  RoutinePick get pick =>
      (department: department, section: section, group: group);
}

class SavedTeacher extends SavedRoutine {
  const SavedTeacher(super.department, this.initials);

  final String initials;

  TeacherPick get pick => (department: department, initials: initials);
}

/// The section or teacher's week made "mine", kept on the phone. Phones from
/// before EEE have a CSE section without a department.
class MyRoutineChoice extends Notifier<SavedRoutine?> {
  @override
  SavedRoutine? build() {
    final prefs = ref.watch(prefsProvider);
    final department =
        departmentFrom(prefs.getString(_departmentKey)) ??
        RoutineDepartmentSlug.cse;
    if (prefs.getString(_teacherKey) case final initials?) {
      return SavedTeacher(department, initials);
    }
    final section = prefs.getString(_pickKey);
    return section == null
        ? null
        : SavedSection(department, section, prefs.getString(_groupKey));
  }

  void set(SavedRoutine? saved) {
    final prefs = ref.read(prefsProvider);
    state = saved;
    for (final key in [
      _departmentKey,
      _pickKey,
      _groupKey,
      _teacherKey,
      _cacheKey,
      _teacherCacheKey,
    ]) {
      prefs.remove(key);
    }
    switch (saved) {
      case null:
        return;
      case SavedSection(:final section, :final group):
        prefs.setString(_pickKey, section);
        if (group != null) prefs.setString(_groupKey, group);
      case SavedTeacher(:final initials):
        prefs.setString(_teacherKey, initials);
    }
    prefs.setString(_departmentKey, saved.department.json!);
  }
}

final myRoutineChoiceProvider =
    NotifierProvider<MyRoutineChoice, SavedRoutine?>(MyRoutineChoice.new);

/// Whether [saved] is the section [pick].
bool isMySection(SavedRoutine? saved, RoutinePick pick) =>
    saved is SavedSection &&
    saved.department == pick.department &&
    saved.section == pick.section &&
    saved.group == pick.group;

/// Whether [saved] is the teacher [pick].
bool isMyTeacher(SavedRoutine? saved, TeacherPick pick) =>
    saved is SavedTeacher &&
    saved.department == pick.department &&
    saved.initials == pick.initials;

/// My routine's week for Today: fresh from the network when there is one, else
/// the copy kept from last time ([offline]). [updatedFrom] is the version the
/// phone had before, when the routine changed since.
typedef MyRoutine = ({
  SavedRoutine saved,

  /// "67_B1", or the teacher's name.
  String name,
  List<RoutineClass> classes,

  /// The section's name; "" for a teacher's week.
  String section,
  RoutineVersion version,
  bool offline,
  String? updatedFrom,
});

final myRoutineProvider = FutureProvider<MyRoutine?>(retry: _retry, (
  ref,
) async {
  final saved = ref.watch(myRoutineChoiceProvider);
  if (saved == null) return null;
  final prefs = ref.read(prefsProvider);
  final cacheKey = saved is SavedTeacher ? _teacherCacheKey : _cacheKey;

  MyRoutine of(Object routine, {required bool offline, String? before}) {
    final version = switch (routine) {
      RoutineSection r => r.version,
      RoutineTeacherWeek w => w.version,
      _ => throw StateError('$routine'),
    };
    return (
      saved: saved,
      name: switch (routine) {
        RoutineTeacherWeek w => teacherName(w.teacher.initials, w.teacher.name),
        _ => pickLabel((saved as SavedSection).section, saved.group),
      },
      classes: switch (routine) {
        RoutineSection r => classesFor(
          r.classes,
          (saved as SavedSection).group,
        ),
        RoutineTeacherWeek w => [for (final c in w.classes) AttendedClass(c)],
        _ => const [],
      },
      section: routine is RoutineSection ? routine.section : '',
      version: version,
      offline: offline,
      updatedFrom: before != null && before != version.version ? before : null,
    );
  }

  Object? cached;
  try {
    final json = prefs.getString(cacheKey);
    if (json != null) {
      final map = jsonDecode(json) as Map<String, Object?>;
      cached = switch (saved) {
        SavedSection(:final section) => RoutineSection.fromJson(
          map,
        ).let((r) => r.section == section ? r : null),
        SavedTeacher(:final initials) => RoutineTeacherWeek.fromJson(
          map,
        ).let((w) => w.teacher.initials == initials ? w : null),
      };
    }
  } on Object {
    // An old or broken copy: fetched again below.
  }
  final before = switch (cached) {
    RoutineSection r => r.version.version,
    RoutineTeacherWeek w => w.version.version,
    _ => null,
  };
  try {
    final Object routine = switch (saved) {
      SavedSection(:final department, :final section) => await ref.watch(
        routineSectionProvider((department: department, section: section))
            .future,
      ),
      SavedTeacher(:final pick) => await ref.watch(
        routineTeacherProvider(pick).future,
      ),
    };
    await prefs.setString(
      cacheKey,
      jsonEncode(switch (routine) {
        RoutineSection r => r.toJson(),
        RoutineTeacherWeek w => w.toJson(),
        _ => const <String, Object?>{},
      }),
    );
    return of(routine, offline: false, before: before);
  } on Object catch (error) {
    // Offline: last time's copy. Gone from a new routine (404): say so.
    if (cached != null && !isMissing(error)) return of(cached, offline: true);
    rethrow;
  }
});

/// The department Students and Teachers show: the one last picked there, else
/// the saved routine's, else CSE.
class BrowseDepartment extends Notifier<RoutineDepartmentSlug> {
  @override
  RoutineDepartmentSlug build() {
    final prefs = ref.watch(prefsProvider);
    return departmentFrom(prefs.getString(_browseKey)) ??
        ref.read(myRoutineChoiceProvider)?.department ??
        RoutineDepartmentSlug.cse;
  }

  void set(RoutineDepartmentSlug department) {
    state = department;
    ref.read(prefsProvider).setString(_browseKey, department.json!);
  }
}

final browseDepartmentProvider =
    NotifierProvider<BrowseDepartment, RoutineDepartmentSlug>(
      BrowseDepartment.new,
    );

extension _Let<T> on T {
  R let<R>(R Function(T it) f) => f(this);
}

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
/// "67 B1", EEE's "12b"): those starting with it first.
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

/// What a section belongs to: CSE's batch ("67" of 67_B) or EEE's level and
/// term ("1-2" of 1-2 B), with the section's letter; null for retakes and others.
({String key, String title, String name, String letter})? sectionGroup(
  String section,
) {
  if (RegExp(r'^(\d+)_([A-Za-z]+)$').firstMatch(section) case final m?) {
    return (key: m[1]!, title: m[1]!, name: 'Batch ${m[1]}', letter: m[2]!);
  }
  if (RegExp(r'^(\d)-(\d) ([A-Z]+)$').firstMatch(section) case final m?) {
    return (
      key: '${m[1]}-${m[2]}',
      title: '${m[1]}-${m[2]}',
      name: 'Level ${m[1]}, term ${m[2]}',
      letter: m[3]!,
    );
  }
  return null;
}

/// Sections by batch (the newest first) or level and term (the first first);
/// retakes and others last.
List<({String key, String title, String? name, List<String> sections})>
sectionGroups(List<RoutineSectionSummary> sections) {
  final groups = <String, List<String>>{};
  final names = <String, ({String title, String name})>{};
  for (final s in sections) {
    final of = sectionGroup(s.section);
    final key = of?.key ?? '';
    (groups[key] ??= []).add(s.section);
    if (of != null) names[key] = (title: of.title, name: of.name);
  }
  final keys = groups.keys.toList()
    ..sort((a, b) {
      if (a.isEmpty || b.isEmpty) return a.isEmpty ? 1 : (b.isEmpty ? -1 : 0);
      return a.contains('-')
          ? a.compareTo(b)
          : int.parse(b).compareTo(int.parse(a));
    });
  return [
    for (final k in keys)
      (
        key: k,
        title: names[k]?.title ?? 'Retakes',
        name: names[k]?.name,
        sections: groups[k]!,
      ),
  ];
}

/// Teachers matching what was typed: by initials ("sta", those starting with it
/// first), then by a word of their name ("sample"), then anywhere in the name.
List<RoutineTeacherSummary> matchTeachers(
  List<RoutineTeacherSummary> teachers,
  String query,
) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return teachers;
  final ranked = <(RoutineTeacherSummary, int)>[];
  for (final t in teachers) {
    final initials = t.initials.toLowerCase();
    final name = t.name?.toLowerCase() ?? '';
    final rank = initials == q
        ? 0
        : initials.startsWith(q)
        ? 1
        : name.split(RegExp(r'[\s.]+')).any((w) => w.startsWith(q))
        ? 2
        : name.contains(q)
        ? 3
        : -1;
    if (rank >= 0) ranked.add((t, rank));
  }
  ranked.sort((a, b) => a.$2.compareTo(b.$2));
  return [for (final (t, _) in ranked) t];
}
