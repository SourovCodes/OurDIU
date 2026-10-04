import 'dart:convert';
import 'dart:io';

import 'package:diuqbank/api/generated/export.dart';
import 'package:diuqbank/data/routine.dart';
import 'package:diuqbank/features/routine/routine_home_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_harness.dart';

Map<String, Object?> _class(
  String day,
  String start,
  String end,
  String code, {
  String? title,
  String? labGroup,
  String room = 'KT-213',
}) => {
  'day': day,
  'start': start,
  'end': end,
  'course': {'code': code, 'title': title},
  'labGroup': labGroup,
  'room': room,
  'roomType': labGroup == null ? null : 'lab',
  'teacher': {'initials': 'STA', 'name': null},
};

const _version = {
  'department': 'CSE',
  'version': '4.1',
  'publishedOn': '2026-10-02',
  'source': null,
  'liveSince': '2026-10-02T03:28:00.000Z',
};

final _slots = [
  for (final (s, e) in [
    ('08:30', '10:00'),
    ('10:00', '11:30'),
    ('11:30', '13:00'),
    ('13:00', '14:30'),
    ('14:30', '16:00'),
    ('16:00', '17:30'),
  ])
    {'start': s, 'end': e},
];

Map<String, Object?> section67b({String version = '4.1'}) => {
  'version': {..._version, 'version': version},
  'section': '67_B',
  'labGroups': ['B1', 'B2'],
  'slots': _slots,
  'classes': [
    _class('SAT', '13:00', '14:30', 'CSE321', title: 'Computer Networks'),
    _class('SUN', '10:00', '11:30', 'CSE315', title: 'Software Engineering'),
    _class(
      'MON',
      '08:30',
      '11:30',
      'CSE322',
      title: 'Computer Networks Lab',
      labGroup: 'B2',
    ),
    _class(
      'MON',
      '14:30',
      '17:30',
      'CSE322',
      title: 'Computer Networks Lab',
      labGroup: 'B1',
    ),
  ],
};

final _sections = {
  'version': _version,
  'sections': [
    {'section': '65_A', 'labGroups': <String>[], 'classCount': 6},
    {
      'section': '67_B',
      'labGroups': ['B1', 'B2'],
      'classCount': 10,
    },
  ],
};

const _sta = {
  'initials': 'STA',
  'name': 'Dr. Test Teacher',
  'phone': '01712345678',
  'email': 'sta@example.com',
  'room': 'KT-712',
};

Map<String, Object?> _teacherClass(
  String day,
  String start,
  String end,
  List<Map<String, Object?>> sections,
) => {
  'day': day,
  'start': start,
  'end': end,
  'course': {'code': 'CSE322', 'title': 'Computer Networks Lab'},
  'room': 'G1-014',
  'roomType': null,
  'sections': sections,
};

final _teachers = {
  'version': _version,
  'teachers': [
    {
      'initials': 'AS',
      'name': null,
      'courses': ['CSE315'],
      'classCount': 2,
    },
    {
      'initials': 'STA',
      'name': 'Dr. Test Teacher',
      'courses': ['CSE321', 'CSE322'],
      'classCount': 3,
    },
  ],
};

final _staWeek = {
  'version': _version,
  'teacher': _sta,
  'slots': _slots,
  'classes': [
    _teacherClass('MON', '08:30', '11:30', [
      {'section': '67_B', 'labGroup': 'B2'},
    ]),
    _teacherClass('MON', '14:30', '17:30', [
      {'section': '67_B', 'labGroup': 'B1'},
      {'section': '67_C', 'labGroup': null},
    ]),
  ],
};

FakeBackend routineBackend({Map<String, Object?>? week}) => FakeBackend({
  'GET /api/v1/routine/cse/sections': (_) => reply(_sections),
  'GET /api/v1/routine/cse/sections/67_B': (_) => reply(week ?? section67b()),
  'GET /api/v1/routine/cse/teachers': (_) => reply(_teachers),
  'GET /api/v1/routine/cse/teachers/STA': (_) => reply(_staWeek),
});

RoutineClass _c(String day, String start, String end) =>
    RoutineClass.fromJson(_class(day, start, end, 'CSE315'));

Future<void> _openRoutine(WidgetTester tester) async {
  await tester.tap(find.bySemanticsLabel('Question Bank, switch product'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Class Routine'));
  await tester.pumpAndSettle();
}

void main() {
  group('time in Dhaka', () {
    test('is UTC+6, and the week starts on Saturday', () {
      // Saturday 23:30 UTC is Sunday 05:30 in Dhaka.
      final now = dhakaNow(DateTime.utc(2026, 10, 3, 23, 30));
      expect(now.day, RoutineDay.sun);
      expect(now.minutes, 5 * 60 + 30);
      final dates = weekDates(now);
      expect(dates[RoutineDay.sat]!.day, 3);
      expect(dates[RoutineDay.thu]!.day, 8);
    });

    test('finds the next class today, tomorrow or next week', () {
      final week = [
        _c('SUN', '10:00', '11:30'),
        _c('SUN', '14:30', '16:00'),
        _c('MON', '08:30', '11:30'),
      ];
      DhakaNow at(RoutineDay day, int h, int m) =>
          (day: day, minutes: h * 60 + m, date: DateTime.utc(2026));
      expect(nextClass(week, at(RoutineDay.sun, 10, 40))!.c.start, '14:30');
      expect(nextClass(week, at(RoutineDay.sun, 17, 0))!.daysAhead, 1);
      final later = nextClass(week, at(RoutineDay.tue, 9, 0))!;
      expect((later.c.day, later.daysAhead), (RoutineDay.sun, 5));
      expect(classState(week[0], at(RoutineDay.sun, 10, 40)), ClassState.now);
    });

    test('names times as students say them', () {
      expect(timeRange('10:00', '11:30'), '10:00 – 11:30 am');
      expect(timeRange('11:30', '13:00'), '11:30 am – 1:00 pm');
      expect(groupLabel('67_B', 'B1'), '67_B1');
      expect(isRegularSection('RE_A(3C)'), isFalse);
      // EEE's sections have a space.
      expect(groupLabel('1-2 B', 'B1'), '1-2 B1');
      expect(isRegularSection('1-2 B'), isTrue);
    });
  });

  test('the search finds sections and lab groups as typed', () {
    final list = RoutineSectionList.fromJson(_sections);
    final choices = sectionChoices(list.sections);
    expect(matchSections(choices, '67b').map((c) => c.label), [
      '67_B',
      '67_B1',
      '67_B2',
    ]);
    expect(matchSections(choices, '67 b2').single.group, 'B2');
    expect(sectionGroups(list.sections).map((b) => b.title), ['67', '65']);
    // EEE's by level and term, the first first; retakes last.
    final eee = RoutineSectionList.fromJson({
      'version': _version,
      'sections': [
        for (final s in ['2-1 A', '1-2 B', 'RE_X', '1-2 A'])
          {'section': s, 'labGroups': <String>[], 'classCount': 4},
      ],
    });
    expect(
      sectionGroups(eee.sections)
          .map((g) => '${g.title}: ${g.sections.join(', ')}'),
      ['1-2: 1-2 B, 1-2 A', '2-1: 2-1 A', 'Retakes: RE_X'],
    );
    expect(
      matchSections(sectionChoices(eee.sections), '12b').single.label,
      '1-2 B',
    );
  });

  test('teachers are found by initials, then by name', () {
    final list = RoutineTeacherList.fromJson(_teachers);
    expect(matchTeachers(list.teachers, 'st').map((t) => t.initials), ['STA']);
    expect(matchTeachers(list.teachers, 'test').single.initials, 'STA');
    expect(matchTeachers(list.teachers, '').length, 2);
    final c = AttendedClass(RoutineTeacherWeek.fromJson(_staWeek).classes.last);
    expect(c.roomType, RoutineRoomType.lab);
    expect(attendingLabel(c.sections), '67_B1, 67_C');
  });

  test('the home-screen widgets get the saved week in short', () {
    final section = RoutineSection.fromJson(section67b());
    final mine = (
      saved: const SavedSection(RoutineDepartmentSlug.cse, '67_B', 'B1'),
      name: '67_B1',
      classes: classesFor(section.classes, 'B1'),
      section: '67_B',
      version: section.version,
      offline: false,
      updatedFrom: null,
    );
    final data = jsonDecode(routineWidgetData(mine)!) as Map<String, Object?>;
    expect(data['label'], '67_B1');
    expect(data['version'], '4.1');
    final classes = data['classes']! as List;
    expect(classes, hasLength(3));
    expect(classes.last, {
      'day': 'MON',
      'start': '14:30',
      'end': '17:30',
      'course': 'Computer Networks Lab',
      'who': 'B1 lab',
      'room': 'KT-213',
      'lab': true,
    });

    final week = RoutineTeacherWeek.fromJson(_staWeek);
    final teacher = (
      saved: const SavedTeacher(RoutineDepartmentSlug.cse, 'STA'),
      name: 'Dr. Test Teacher',
      classes: [for (final c in week.classes) AttendedClass(c)],
      section: '',
      version: week.version,
      offline: false,
      updatedFrom: null,
    );
    final t = jsonDecode(routineWidgetData(teacher)!) as Map<String, Object?>;
    expect(t['label'], 'STA');
    expect((t['classes']! as List).last, containsPair('who', '67_B1, 67_C'));
    expect(routineWidgetData(null), isNull);
  });

  testWidgets('the routine is coming soon until one is live', (tester) async {
    await pumpApp(tester);
    await _openRoutine(tester);
    expect(find.text('Coming soon'), findsOneWidget);
  });

  testWidgets('a student finds their section, makes it theirs, sees the day', (
    tester,
  ) async {
    await pumpApp(tester, backend: routineBackend());
    await _openRoutine(tester);

    // Nothing saved yet: Today offers the two ways in.
    expect(find.text('Your class routine.'), findsOneWidget);
    expect(find.text('Today'), findsOneWidget);
    await tester.tap(find.text('Find your section'));
    await tester.pumpAndSettle();

    // Students: "67b1" finds lab group B1 of 67_B.
    expect(find.text('Students'), findsWidgets);
    await tester.enterText(find.byType(SearchBar), '67b1');
    await tester.pumpAndSettle();
    await tester.tap(find.text('67_B1'));
    await tester.pumpAndSettle();
    expect(
      find.text('CSE batch 67, section B · 3 courses · 3 classes a week'),
      findsOneWidget,
    );
    // On Monday (the tests' today) only B1's lab, never B2's.
    expect(find.text('LAB · 67_B1'), findsOneWidget);
    expect(find.text('LAB · 67_B2'), findsNothing);

    // Both groups show both labs.
    await tester.tap(find.widgetWithText(ChoiceChip, 'Both groups'));
    await tester.pumpAndSettle();
    expect(find.text('LAB · 67_B2'), findsOneWidget);
    await tester.tap(find.widgetWithText(ChoiceChip, '67_B1'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Make it my section'));
    await tester.pumpAndSettle();
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('routine_department'), 'cse');
    expect(prefs.getString('routine_section'), '67_B');
    expect(prefs.getString('routine_group'), 'B1');

    // Back on Today with the section's day and week; kept for offline use.
    expect(find.text('Monday 5 October'), findsOneWidget);
    expect(find.text('My section · CSE 67_B1'), findsOneWidget);
    // The lab is next: on the Today card and in the week.
    expect(find.text('LAB · 67_B1'), findsWidgets);
    expect(prefs.getString('routine_cache'), contains('"version":"4.1"'));
  });

  testWidgets("a section's teacher leads to their week", (tester) async {
    final week = section67b();
    final classes = [
      for (final c in week['classes']! as List)
        {...c as Map<String, Object?>, 'teacher': _sta},
    ];
    await pumpApp(
      tester,
      backend: routineBackend(week: {...week, 'classes': classes}),
    );
    await _openRoutine(tester);
    await tester.tap(find.text('Find your section'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(SearchBar), '67b');
    await tester.pumpAndSettle();
    await tester.tap(find.text('67_B').last);
    await tester.pumpAndSettle();

    // Under each of their courses, with where they sit.
    final teacher = find.textContaining('Sits in KT-712').first;
    await tester.ensureVisible(teacher);
    await tester.pumpAndSettle();
    await tester.tap(teacher);
    await tester.pumpAndSettle();
    // The sheet: how to reach them, and their week.
    expect(find.text('sta@example.com'), findsOneWidget);
    expect(find.text('01712345678'), findsOneWidget);
    await tester.tap(find.text('See their week'));
    await tester.pumpAndSettle();
    expect(
      find.text('STA · CSE teacher · 1 course · 2 sections · 2 classes a week'),
      findsOneWidget,
    );
  });

  testWidgets('a teacher finds their week, and makes it theirs', (
    tester,
  ) async {
    await pumpApp(tester, backend: routineBackend());
    await _openRoutine(tester);
    await tester.tap(find.text('Teachers'));
    await tester.pumpAndSettle();
    expect(find.text('2 teachers, by initials'), findsOneWidget);

    // Filtered as you type, by initials or name.
    await tester.enterText(find.byType(SearchBar), 'test');
    await tester.pumpAndSettle();
    expect(find.text('1 of 2 teachers'), findsOneWidget);
    await tester.tap(find.text('Dr. Test Teacher'));
    await tester.pumpAndSettle();

    // Monday's classes say who attends; a shared class lists both sections.
    expect(find.text('67_B1, 67_C'), findsWidgets);
    final chip = find.widgetWithText(ActionChip, '67_C');
    await tester.ensureVisible(chip);
    expect(chip, findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Make it my routine'),
      -200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Make it my routine'));
    await tester.pumpAndSettle();
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('routine_teacher'), 'STA');
    expect(prefs.getString('routine_section'), isNull);
    expect(find.text('My routine · CSE Dr. Test Teacher'), findsOneWidget);
  });

  testWidgets('a department without a routine yet says so', (tester) async {
    await pumpApp(tester, backend: routineBackend());
    await _openRoutine(tester);
    await tester.tap(find.text('Find your section'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('EEE · soon'));
    await tester.pumpAndSettle();
    expect(find.text('DIU’s EEE routine is coming soon'), findsOneWidget);
  });

  testWidgets('offline, Today shows the routine kept on the phone', (
    tester,
  ) async {
    final backend = FakeBackend({
      'GET /api/v1/routine/cse/sections': (_) => reply(_sections),
      'GET /api/v1/routine/cse/sections/67_B': (_) =>
          throw const SocketException('offline'),
    });
    await pumpApp(
      tester,
      backend: backend,
      prefs: {
        'space': 'questions',
        'routine_section': '67_B',
        'routine_cache': jsonEncode(section67b()),
      },
    );
    await _openRoutine(tester);

    expect(
      find.text('Offline: the routine saved on this phone (v4.1).'),
      findsOneWidget,
    );
    expect(find.text('My section · CSE 67_B'), findsOneWidget);
  });

  testWidgets('says when the routine was updated since last time', (
    tester,
  ) async {
    await pumpApp(
      tester,
      backend: routineBackend(week: section67b(version: '4.2')),
      prefs: {
        'space': 'questions',
        'routine_section': '67_B',
        'routine_cache': jsonEncode(section67b()),
      },
    );
    await _openRoutine(tester);
    expect(
      find.text('The routine was updated: v4.1 → v4.2. Check your week.'),
      findsOneWidget,
    );
  });
}
