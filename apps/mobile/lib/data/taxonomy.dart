import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api.dart';
import '../api/generated/export.dart';

/// Departments, courses, semesters and exam types, loaded once per app session
/// (one request, like the site's `loadTaxonomy`).
final taxonomyProvider = FutureProvider<Taxonomy>(
  (ref) => ref.watch(qbApiProvider).taxonomy.getApiV1Taxonomy(),
);

/// "Data Structures" and "Data Structure" (or "Physics-I" and "Physics I") are
/// the same course filed under two names.
String _sameCourseKey(String name) => name
    .toLowerCase()
    .replaceAll('&', ' and ')
    .replaceAllMapped(
      RegExp(r'\s*[-–]\s*(i{1,3}|iv|vi{0,3}|ix|x|\d{1,2})$'),
      (m) => ' ${m[1]}',
    )
    .replaceAll(RegExp(r'[^a-z0-9 ]'), '')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim()
    .replaceAll(RegExp(r's\b'), '');

/// Other courses that are probably [course]: the same name up to a plural, in any
/// department, its own department's first. Papers are filed under the name on the
/// question sheet, so a course's papers can be split across these. As on the
/// website's course page.
List<CourseListItem> sameCourses(
  List<CourseListItem> courses,
  CourseListItem course,
) {
  final key = _sameCourseKey(course.name);
  return [
    for (final c in courses)
      if (c.id != course.id && _sameCourseKey(c.name) == key) c,
  ]..sort(
    (a, b) =>
        (b.departmentId == course.departmentId ? 1 : 0) -
        (a.departmentId == course.departmentId ? 1 : 0),
  );
}
