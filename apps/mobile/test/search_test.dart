import 'package:diuqbank/api/generated/export.dart';
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

  test('finds nothing for blank or unknown text', () {
    expect(names('  '), isEmpty);
    expect(names('chemistry'), isEmpty);
  });

  sameCourseTests();
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
