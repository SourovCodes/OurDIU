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
}
