import 'dart:convert';
import 'dart:io';

import 'package:diuqbank/api/generated/export.dart';
import 'package:diuqbank/data/search.dart';
import 'package:diuqbank/data/taxonomy.dart';
import 'package:diuqbank/features/search/search_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fixtures.dart';

void main() {
  List<String> names(String query) =>
      searchCourses(taxonomy.courses, query).map((c) => c.name).toList();

  test('matches every typed word, ignoring case and order', () {
    expect(names('math'), ['Mathematics I', 'Mathematics II']);
    expect(
      names('STRUCT'),
      containsAll(['Data Structures', 'Structured Programming']),
    );
    expect(names('programming structured'), ['Structured Programming']);
  });

  test('puts names that start with the query first', () {
    expect(names('struct').first, 'Structured Programming');
  });

  test('finds courses by their initials, exact ones first', () {
    expect(names('SP'), ['Structured Programming']);
    expect(names('ds'), ['Data Structures']);
    // More than one word is never read as initials.
    expect(names('ds sp'), isEmpty);
  });

  test('finds nothing for blank or unknown text', () {
    expect(names('  '), isEmpty);
    expect(names('chemistry'), isEmpty);
  });

  sharedCases();
  sameCourseTests();
}

/// The cases the website runs too (apps/web/app/lib/search.test.ts).
void sharedCases() {
  final cases = jsonDecode(
    File('../../packages/shared/test-data/name-search.json').readAsStringSync(),
  ) as Map<String, dynamic>;

  group('the shared name-search cases', () {
    for (final [name as String, expected as String]
        in cases['initials'] as List) {
      test('$name → $expected', () => expect(initials(name), expected));
    }
    for (final [name as String, query as String, expected as int?]
        in cases['rank'] as List) {
      test(
        '$name, "$query" → $expected',
        () => expect(matchRank(name, query), expected),
      );
    }
    for (final c in (cases['order'] as List).cast<Map<String, dynamic>>()) {
      final query = c['query'] as String;
      test('orders $query', () {
        expect(
          searchBy(
            (c['names'] as List).cast<String>(),
            (n) => matchRank(n, query),
          ),
          c['expected'],
        );
      });
    }
  });
}

void sameCourseTests() {
  test('finds the same course filed under another name', () {
    const ds = CourseListItem(
      id: 1,
      name: 'Data Structure',
      departmentId: 5,
      publishedCount: 1,
    );
    const courses = [
      ds,
      CourseListItem(
        id: 2,
        name: 'Data Structures',
        departmentId: 6,
        publishedCount: 1,
      ),
      CourseListItem(
        id: 3,
        name: 'Data Structures',
        departmentId: 5,
        publishedCount: 1,
      ),
      CourseListItem(
        id: 4,
        name: 'Database Systems',
        departmentId: 5,
        publishedCount: 1,
      ),
      CourseListItem(
        id: 5,
        name: 'Physics-I',
        departmentId: 5,
        publishedCount: 1,
      ),
      CourseListItem(
        id: 6,
        name: 'Physics I',
        departmentId: 6,
        publishedCount: 1,
      ),
    ];
    expect(sameCourses(courses, ds).map((c) => c.id), [3, 2]);
    expect(sameCourses(courses, courses[4]).map((c) => c.id), [6]);
    expect(sameCourses(courses, courses[3]), isEmpty);
  });
}
