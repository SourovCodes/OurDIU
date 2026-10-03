import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:diuqbank/api/generated/export.dart';
import 'package:flutter_test/flutter_test.dart';

import 'app_harness.dart';
import 'fixtures.dart';

void main() {
  testWidgets('home leads with search, departments and recent papers', (
    tester,
  ) async {
    await pumpApp(tester);

    expect(find.text('Find your paper'), findsOneWidget);
    expect(find.text('Search 4 courses'), findsOneWidget);
    // Departments with the most papers first, with their counts.
    final cseChip = tester.getTopLeft(find.text('1,220'));
    final sweChip = tester.getTopLeft(find.text('646'));
    expect(cseChip.dx, lessThan(sweChip.dx));
    expect(find.text('Most viewed'), findsOneWidget);
    expect(find.text('6.4k views · CSE'), findsOneWidget);
    await scrollTo(tester, find.text('Structured Programming'));
    expect(find.text('Data Structures'), findsOneWidget);
  });

  testWidgets('browses a department and a course, newest semester first', (
    tester,
  ) async {
    await pumpApp(tester);
    await tester.tap(find.text('Browse'));
    await tester.pumpAndSettle();
    expect(find.text('2 departments, 1,866 papers'), findsOneWidget);

    await tester.tap(find.text('CSE'));
    await tester.pumpAndSettle();
    expect(find.text('Computer Science and Engineering'), findsOneWidget);
    expect(find.text('1,220 papers · 3 courses'), findsOneWidget);

    await tester.tap(find.text('Mathematics I'));
    await tester.pumpAndSettle();
    expect(find.textContaining('4 papers from 4 exams'), findsOneWidget);
    final semesters = ['Spring 26', 'Fall 25', 'Spring 25', 'Fall 24'];
    final ys = [for (final s in semesters) tester.getTopLeft(find.text(s)).dy];
    expect(ys, orderedEquals([...ys]..sort()));

    // Exam types in a fixed order, each with its count.
    final chips = ['Final  2', 'Midterm  1', 'Quiz  1'];
    // Reading order: row by row, then left to right (the chips wrap).
    final order = [
      for (final c in chips)
        tester.getTopLeft(find.text(c)).dy * 10000 +
            tester.getTopLeft(find.text(c)).dx,
    ];
    expect(order, orderedEquals([...order]..sort()));
    await tester.tap(find.text('Midterm  1'));
    await tester.pumpAndSettle();
    expect(find.text('Fall 25'), findsOneWidget);
    expect(find.text('Spring 26'), findsNothing);
  });

  testWidgets('search opens a course and remembers it', (tester) async {
    await pumpApp(tester);
    await tester.tap(find.text('Search 4 courses'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'data');
    await tester.pumpAndSettle();
    expect(find.text('CSE · Computer Science and Engineering'), findsOneWidget);

    // Each result shows the course's paper count.
    await tester.tap(find.text('1 paper'));
    await tester.pumpAndSettle();
    expect(find.text('Data Structures'), findsOneWidget);

    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '');
    await tester.pumpAndSettle();
    expect(find.widgetWithText(ActionChip, 'Data Structures'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'chemistry');
    await tester.pumpAndSettle();
    expect(find.text('No course matches “chemistry”'), findsOneWidget);

    // Home has it under "Jump back in".
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('Jump back in'), findsOneWidget);
    expect(find.widgetWithText(ActionChip, 'Data Structures'), findsOneWidget);
  });

  testWidgets("home's most viewed counts today when enough was viewed", (
    tester,
  ) async {
    final today = [
      for (final (i, course) in [
        'Algorithms',
        'Data Structures',
        'Computer Networks',
        'Operating Systems',
      ].indexed)
        question(
          40 + i,
          course: course,
          courseId: 400 + i,
          views: 9000,
          viewsToday: 312 - i * 50,
        ),
    ];
    await pumpApp(
      tester,
      lists: (query) => query.sort == QuestionSort.trending
          ? Future.value(page(today))
          : defaultLists(query),
    );
    expect(find.text('Most viewed today'), findsOneWidget);
    expect(find.text('312 views today · CSE'), findsOneWidget);
    expect(find.text('Most viewed'), findsNothing);

    await tester.tap(
      find.descendant(
        of: find.ancestor(
          of: find.text('Most viewed today'),
          matching: find.byType(Row),
        ),
        matching: find.text('See all'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.widgetWithText(AppBar, 'Most viewed today'), findsOneWidget);
    expect(find.text('Algorithms'), findsOneWidget);
  });

  testWidgets('home ranks the courses most viewed today', (tester) async {
    TrendingCourse course(int id, String name, int views) => TrendingCourse(
      id: id,
      name: name,
      departmentId: 5,
      publishedCount: 10,
      department: const Department(
        id: 5,
        name: 'Computer Science and Engineering',
        shortName: 'CSE',
      ),
      viewsToday: views,
    );
    await pumpApp(
      tester,
      trendingCourses: [
        course(198, 'Mathematics I', 1250),
        course(401, 'Algorithms', 300),
        course(402, 'Computer Networks', 120),
        course(403, 'Operating Systems', 80),
      ],
    );
    await scrollTo(tester, find.text('Most viewed courses today'));
    expect(find.text('CSE · 1.3k views today'), findsOneWidget);

    await tester.tap(find.text('Mathematics I'));
    await tester.pumpAndSettle();
    expect(find.textContaining('4 papers from 4 exams'), findsOneWidget);
  });

  testWidgets('home leaves out courses when few were viewed today', (
    tester,
  ) async {
    await pumpApp(tester);
    expect(find.text('Most viewed courses today'), findsNothing);
  });

  testWidgets('a quiet day falls back to the all-time most viewed', (
    tester,
  ) async {
    // Only one exam was viewed today: not enough for the row.
    await pumpApp(
      tester,
      lists: (query) => query.sort == QuestionSort.trending
          ? Future.value(page([question(50, viewsToday: 3)]))
          : defaultLists(query),
    );
    expect(find.text('Most viewed'), findsOneWidget);
    expect(find.text('Most viewed today'), findsNothing);
    expect(find.text('6.4k views · CSE'), findsOneWidget);
  });

  testWidgets('offline, home says so and points to saved papers', (
    tester,
  ) async {
    await pumpApp(
      tester,
      lists: (_) => Future.error(
        DioException(
          requestOptions: RequestOptions(),
          type: DioExceptionType.connectionError,
        ),
      ),
    );
    expect(find.text("You're offline"), findsOneWidget);

    await tester.tap(find.text('Open saved'));
    await tester.pumpAndSettle();
    expect(find.text('Keep papers for exam week'), findsOneWidget);
  });

  testWidgets('a saved paper appears in Saved', (tester) async {
    final counter = await pumpApp(tester);
    await scrollTo(tester, find.text('Structured Programming'));
    await tester.tap(find.text('Structured Programming'));
    await tester.pumpAndSettle();

    expect(find.text('PDF https://files.example/1.pdf'), findsOneWidget);
    expect(counter.views, ['question 7', 'paper 1']);
    await tester.tap(find.byTooltip('Save'));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Remove from saved'), findsOneWidget);

    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(
      find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text('Saved'),
      ),
    );
    await tester.pumpAndSettle();
    // The loaded question's own details are what's saved.
    expect(
      find.descendant(
        of: find.byType(ListView),
        matching: find.text(questionDetail([]).course.name),
      ),
      findsOneWidget,
    );
  });
}
