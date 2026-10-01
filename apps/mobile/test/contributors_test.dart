import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'app_harness.dart';

Map<String, Object?> contributorJson(int n, {int papers = 10}) => {
  'id': 'u$n',
  'username': 'student$n',
  'name': 'Student $n',
  'image': null,
  'joinedAt': '2025-03-01T00:00:00.000Z',
  'publishedCount': papers,
  'viewCount': papers * 100,
  'departments': [
    {
      'id': 5,
      'name': 'Computer Science and Engineering',
      'shortName': 'CSE',
      'publishedCount': papers,
    },
  ],
};

void main() {
  testWidgets('Home leads to the contributors and a profile', (tester) async {
    final backend = FakeBackend({
      'GET /api/v1/contributors': (_) => reply({
        'items': [
          for (var n = 1; n <= 5; n++) contributorJson(n, papers: 20 - n),
        ],
        'page': 1,
        'pageSize': 30,
        'total': 5,
      }),
      'GET /api/v1/contributors/student2': (_) => reply({
        ...contributorJson(2, papers: 18),
        'submissions': {'items': [], 'page': 1, 'pageSize': 50, 'total': 0},
      }),
    });
    await pumpApp(tester, backend: backend);

    await tester.scrollUntilVisible(
      find.text('Top contributors'),
      300,
      // Home's own list, not the carousel or chips inside it.
      scrollable: find.byType(Scrollable).first,
    );
    // Clear of the navigation bar.
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -300));
    await tester.pumpAndSettle();
    await tester.tap(
      find.descendant(
        of: find.ancestor(
          of: find.text('Top contributors'),
          matching: find.byType(Row),
        ),
        matching: find.text('See all'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Contributors'), findsOneWidget);
    // The top three as tiles with their rank, then rows from #4.
    expect(find.text('#1'), findsOneWidget);
    expect(find.text('#4'), findsOneWidget);

    await tester.tap(find.text('Student 2'));
    await tester.pumpAndSettle();
    expect(find.text('Contributor since March 2025'), findsOneWidget);
    expect(find.text('Nothing published yet.'), findsOneWidget);
  });
}
