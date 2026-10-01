import 'package:diuqbank/features/questions/paper_titles.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fixtures.dart';

// The same cases as paperTitles in apps/web/app/lib/submissions.test.ts.
void main() {
  test('keeps distinct titles as they are', () {
    final titles = paperTitles([
      submission(1, batch: '61', uploader: uploader('Jane')),
      submission(2, batch: '62', uploader: uploader('Sam')),
    ]);
    expect(titles.values, ['Batch 61', 'Batch 62']);
  });

  test(
    'adds the uploader to clashing details, then numbers what still clashes',
    () {
      final titles = paperTitles([
        submission(1, batch: '65', uploader: uploader('Jane')),
        submission(2, batch: '65', uploader: uploader('Sam')),
        submission(3),
        submission(4, batch: '65', uploader: uploader('Sam')),
      ]);
      expect(titles.values, [
        'Batch 65 · Jane',
        'Batch 65 · Sam (1)',
        'Paper 3',
        'Batch 65 · Sam (2)',
      ]);
    },
  );

  test('falls back to the uploader, then a number', () {
    final titles = paperTitles([
      submission(1, section: '5A', batch: '61'),
      submission(2, uploader: uploader('Jane')),
      submission(3),
    ]);
    expect(titles.values, ['Section 5A · Batch 61', 'By Jane', 'Paper 3']);
  });
}
