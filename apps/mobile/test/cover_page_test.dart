import 'dart:convert';

import 'package:diuqbank/api/generated/export.dart';
import 'package:diuqbank/auth/token.dart';
import 'package:diuqbank/data/cover_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_harness.dart';
import 'fixtures.dart';

Map<String, Object?> _class(
  String day,
  String code,
  String title, {
  Map<String, Object?>? teacher,
}) => {
  'day': day,
  'start': '10:00',
  'end': '11:30',
  'course': {'code': code, 'title': title},
  'labGroup': null,
  'room': 'KT-213',
  'roomType': null,
  'teacher': teacher,
};

const _sta = {
  'initials': 'STA',
  'name': 'Dr. Test Teacher',
  'designation': 'Associate Professor',
};

final _section = {
  'version': {
    'department': 'CSE',
    'version': '4.1',
    'publishedOn': '2026-10-02',
    'source': null,
    'liveSince': '2026-10-02T03:28:00.000Z',
  },
  'section': '67_B',
  'labGroups': <String>[],
  'slots': [
    {'start': '10:00', 'end': '11:30'},
  ],
  'classes': [
    _class('SAT', 'CSE311', 'Operating Systems', teacher: _sta),
    _class(
      'SUN',
      'ENG101',
      'English I',
      // The routine knows only their initials.
      teacher: {'initials': 'RK', 'name': null},
    ),
  ],
};

/// A student with a saved section, signed in with a student ID.
FakeBackend _backend({int status = 200}) => FakeBackend({
  'GET /api/v1/me': (_) => reply({...profileJson(), 'studentId': '241-15-047'}),
  'GET /api/v1/routine/cse/sections/67_B': (_) => reply(_section),
  'GET /api/v1/routine/cse/sections': (_) => reply({
    'version': _section['version'],
    'sections': [
      {'section': '65_A', 'labGroups': <String>[], 'classCount': 6},
      {
        'section': '67_B',
        'labGroups': ['B1'],
        'classCount': 10,
      },
    ],
  }),
  for (final format in ['pdf', 'docx'])
    for (final t in coverTemplates)
      'POST /api/v1/cover-page/${t.json}/$format': (_) => reply(
        'file',
        status: status,
        headers: {
          'content-disposition':
              'attachment; filename="CSE311-${t.json}.$format"',
        },
      ),
});

const _student = {
  'space': 'cover',
  'routine_department': 'cse',
  'routine_section': '67_B',
};

Map<String, Object?> _sent(FakeBackend backend, String route) =>
    backend.sent(route).single.data as Map<String, Object?>;

Finder _field(String label) => find.widgetWithText(TextField, label);

String _text(WidgetTester tester, String label) =>
    tester.widget<TextField>(_field(label).first).controller!.text;

Finder _rich(String text) => find.textContaining(text, findRichText: true);

/// Scrolls the maker's form (not a text box's own scrolling) to [finder].
Future<void> _scrollTo(
  WidgetTester tester,
  Finder finder, {
  double by = 200,
}) async {
  await tester.scrollUntilVisible(
    finder,
    by,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
}

/// The topic box, named by the question above it.
final _topic = _field('What the assignment is about');

void main() {
  test('a student ID tells the department', () {
    expect(departmentOfStudentId('241-15-047'), 'CSE');
    expect(departmentOfStudentId('221-35-1234'), 'SWE');
    expect(departmentOfStudentId('0242310005101234'), 'CSE');
    expect(departmentOfStudentId('241-99-047'), isNull);
    expect(departmentOfStudentId('nusrat'), isNull);
  });

  test('the semester and date are Dhaka’s', () {
    // 11 pm on 31 August in UTC is 1 September in Dhaka: Fall.
    final at = DateTime.utc(2026, 8, 31, 23);
    expect(semesterOn(at), 'Fall 2026');
    expect(dhakaDate(at), '01/09/2026');
    expect(semesterOn(DateTime.utc(2026, 4, 30, 12)), 'Spring 2026');
    expect(semesterOn(DateTime.utc(2026, 5, 1, 12)), 'Summer 2026');
  });

  test('a course another department teaches leaves its department blank', () {
    final courses = routineCourses(
      [
        for (final c in _section['classes']! as List)
          RoutineClass.fromJson(c as Map<String, Object?>),
      ],
      'CSE',
      {'CSE': 'Computer Science and Engineering'},
    );
    expect(courses.map((c) => c.code), ['CSE311', 'ENG101']);
    expect(
      courses.first.teacherDepartment,
      'Department of Computer Science and Engineering',
    );
    expect(courses.first.teacherDesignation, 'Associate Professor');
    expect(courses.last.teacherDepartment, '');
  });

  test('the page gets only its template’s fields', () {
    final values = {
      CoverField.courseCode: 'CSE311',
      CoverField.topic: 'Deadlocks',
      CoverField.experimentName: 'Round robin',
      CoverField.studentName: 'Nusrat',
    };
    final finalLab = coverPageInput(CoverPageTemplate.finalLabReport, values);
    expect(finalLab.courseCode, 'CSE311');
    expect(finalLab.topic, isNull);
    expect(finalLab.experimentName, isNull);
    expect(finalLab.members, isNull);

    final group = coverPageInput(
      CoverPageTemplate.groupAssignment,
      values,
      members: [(name: 'Nusrat', id: '241-15-047'), (name: ' ', id: '')],
    );
    expect(group.studentName, isNull);
    expect(group.topic, 'Deadlocks');
    expect(group.members!.map((m) => m.name), ['Nusrat']);
  });

  testWidgets('fills in a cover page from the routine and shares it', (
    tester,
  ) async {
    final backend = _backend();
    final shares = <({String name, CoverFormat format})>[];
    await pumpApp(
      tester,
      backend: backend,
      tokens: MemoryTokenStore('session.sig'),
      prefs: _student,
      coverShares: shares,
    );

    expect(find.text('What’s it for?'), findsOneWidget);
    expect(find.text('67_B · Change'), findsOneWidget);
    // Every template shows, none hidden off the side.
    expect(find.text('Presentation').hitTestable(), findsOneWidget);
    // Until a course is picked, "Submitted to" waits for it.
    expect(_field('Teacher'), findsNothing);

    // The section's courses by title, with who takes them.
    expect(find.text('CSE311 · Dr. Test Teacher'), findsOneWidget);
    await tester.tap(find.text('Operating Systems'));
    await tester.pumpAndSettle();
    // The list folds to the course picked.
    expect(find.text('English I'), findsNothing);
    expect(find.text('Change'), findsWidgets);
    // Filled in, "Submitted to" folds to the teacher's name.
    expect(_rich('Dr. Test Teacher'), findsOneWidget);
    await tester.enterText(_topic, 'Deadlock avoidance');
    await _scrollTo(tester, _rich('Submitted by'));
    expect(_rich('Nusrat Jahan, 241-15-047'), findsOneWidget);
    expect(find.text('Today, 5 October 2026'), findsOneWidget);

    await tester.tap(find.text('Preview'));
    await tester.pumpAndSettle();
    expect(find.text('Cover PDF CSE311-assignment.pdf'), findsOneWidget);
    // Nothing's blank: no notice.
    expect(_rich('Left blank'), findsNothing);
    expect(_sent(backend, 'POST /api/v1/cover-page/assignment/pdf'), {
      'courseCode': 'CSE311',
      'courseTitle': 'Operating Systems',
      'topic': 'Deadlock avoidance',
      'teacherName': 'Dr. Test Teacher',
      'teacherDesignation': 'Associate Professor',
      'teacherDepartment': 'Department of Computer Science and Engineering',
      'studentName': 'Nusrat Jahan',
      'studentId': '241-15-047',
      'section': '67_B',
      'semester': 'Fall 2026',
      'studentDepartment': 'Department of Computer Science and Engineering',
      'date': '05/10/2026',
    });

    // The page zooms on its own screen.
    await tester.tap(find.text('Cover PDF CSE311-assignment.pdf'));
    await tester.pumpAndSettle();
    expect(find.byType(InteractiveViewer), findsOneWidget);
    await tester.tap(find.byType(CloseButton));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Share PDF'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Word file'));
    await tester.pumpAndSettle();
    expect(shares, [
      (name: 'CSE311-assignment.pdf', format: CoverFormat.pdf),
      (name: 'CSE311-assignment.docx', format: CoverFormat.docx),
    ]);
    // The PDF shared is the one shown, not made again.
    expect(
      backend.sent('POST /api/v1/cover-page/assignment/pdf'),
      hasLength(1),
    );

    // The student's own details are kept, never the work's.
    final prefs = await SharedPreferences.getInstance();
    final kept = jsonDecode(
      prefs.getString('cover_page_details')!,
    ) as Map<String, Object?>;
    expect(kept, {
      'studentName': 'Nusrat Jahan',
      'studentId': '241-15-047',
      'section': '67_B',
      'studentDepartment': 'Department of Computer Science and Engineering',
    });
  });

  testWidgets('asks for a teacher the routine knows only by initials', (
    tester,
  ) async {
    await pumpApp(
      tester,
      backend: _backend(),
      tokens: MemoryTokenStore('session.sig'),
      prefs: _student,
    );

    expect(find.text('ENG101 · RK'), findsOneWidget);
    await tester.tap(find.text('English I'));
    await tester.pumpAndSettle();
    await scrollTo(
      tester,
      find.text('The routine only has their initials, RK.'),
    );
    expect(_text(tester, 'Teacher'), '');

    await tester.enterText(_topic, 'Essay');
    await tester.tap(find.text('Preview'));
    await tester.pumpAndSettle();
    expect(_rich('teacher'), findsOneWidget);

    // "Fill in" goes back to the form, as it was.
    await tester.tap(find.text('Fill in'));
    await tester.pumpAndSettle();
    expect(find.text('English I'), findsOneWidget);
    expect(_text(tester, 'What the assignment is about'), 'Essay');
  });

  testWidgets('without a section: choose one, without changing My section', (
    tester,
  ) async {
    final backend = _backend();
    await pumpApp(tester, backend: backend, prefs: const {'space': 'cover'});

    await _scrollTo(tester, find.text('Sign in to fill in your name and ID'));
    await _scrollTo(tester, find.text('Choose your section'), by: -200);
    await tester.tap(find.text('Choose your section'));
    await tester.pumpAndSettle();
    expect(find.text('Your section'), findsOneWidget);
    // A section, not its lab groups.
    expect(find.text('67_B1'), findsNothing);
    await tester.tap(find.text('67_B'));
    await tester.pumpAndSettle();

    await _scrollTo(tester, find.text('67_B · Change'), by: -200);
    expect(find.text('Operating Systems'), findsOneWidget);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('cover_page_section'), 'cse|67_B');
    expect(prefs.getString('routine_section'), isNull);
  });

  testWidgets('says what’s left blank', (tester) async {
    await pumpApp(tester, backend: _backend(), prefs: const {'space': 'cover'});

    await tester.tap(find.text('Preview'));
    await tester.pumpAndSettle();
    expect(
      _rich('course, topic, teacher, your name and your ID'),
      findsOneWidget,
    );
  });

  testWidgets('what the phone kept wins over the account', (tester) async {
    await pumpApp(
      tester,
      backend: _backend(),
      tokens: MemoryTokenStore('session.sig'),
      prefs: {
        ..._student,
        'cover_page_details': jsonEncode({
          'studentName': 'Nusrat J.',
          'studentId': '',
        }),
      },
    );

    await _scrollTo(tester, _rich('Submitted by'));
    expect(_rich('Nusrat J., 241-15-047'), findsOneWidget);
  });

  testWidgets('a group assignment lists its members', (tester) async {
    final backend = _backend();
    await pumpApp(
      tester,
      backend: backend,
      tokens: MemoryTokenStore('session.sig'),
      prefs: _student,
    );

    await tester.tap(find.text('Group assignment'));
    await tester.pumpAndSettle();
    await _scrollTo(tester, find.text('Add a member'));
    await tester.tap(find.text('Add a member'));
    await tester.pumpAndSettle();
    await tester.enterText(_field('Member 2'), 'Rafi Ahmed');
    await tester.enterText(_field('ID').last, '241-15-050');

    await tester.tap(find.text('Preview'));
    await tester.pumpAndSettle();
    final sent = _sent(backend, 'POST /api/v1/cover-page/group-assignment/pdf');
    expect(sent['members'], [
      {'name': 'Nusrat Jahan', 'id': '241-15-047'},
      {'name': 'Rafi Ahmed', 'id': '241-15-050'},
    ]);
    expect(sent.containsKey('studentName'), isFalse);
  });

  testWidgets('says so when the page can’t be made, and tries again', (
    tester,
  ) async {
    final backend = _backend(status: 500);
    await pumpApp(tester, backend: backend, prefs: const {'space': 'cover'});

    await tester.tap(find.text('Preview'));
    await tester.pumpAndSettle();
    expect(find.text("Couldn't make the page"), findsOneWidget);

    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(
      backend.sent('POST /api/v1/cover-page/assignment/pdf'),
      hasLength(2),
    );
  });

  testWidgets('the switcher opens the Cover Page', (tester) async {
    await pumpApp(tester, backend: _backend());

    await tester.tap(find.bySemanticsLabel('Question Bank, switch product'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cover Page'));
    await tester.pumpAndSettle();
    expect(find.text('What’s it for?'), findsOneWidget);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('space'), 'cover');
  });
}
