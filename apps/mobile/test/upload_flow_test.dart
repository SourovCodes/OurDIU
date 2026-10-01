import 'dart:io';

import 'package:diuqbank/auth/token.dart';
import 'package:diuqbank/features/upload/papers.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'app_harness.dart';
import 'fixtures.dart';

Future<void> openAccount(WidgetTester tester) async {
  await tester.tap(
    find.descendant(
      of: find.byType(NavigationBar),
      matching: find.text('Account'),
    ),
  );
  await tester.pumpAndSettle();
}

/// Lets the paper page's timers and requests run without waiting for its
/// endless "checking" animation to settle.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 20; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

PickedPdf pickedPdf({int bytes = 1400000}) {
  final file = File('${Directory.systemTemp.path}/qb-test-paper.pdf')
    ..writeAsBytesSync([0x25, 0x50, 0x44, 0x46]);
  return PickedPdf(
    path: file.path,
    name: 'ds-final.pdf',
    bytes: bytes,
    source: PaperSource.files,
    pages: 2,
  );
}

Map<String, Reply Function(RequestOptions)> signedIn({
  List<Map<String, Object?>> papers = const [],
}) => {
  'GET /api/v1/me': (_) => reply(profileJson()),
  'GET /api/v1/me/submissions': (_) => reply({'items': papers}),
};

void main() {
  testWidgets('shares a paper: pick, fill in, upload, watch the check', (
    tester,
  ) async {
    var checks = 0;
    final backend = FakeBackend({
      ...signedIn(
        papers: [myPaperJson(3, status: 'published', autoPublished: true)],
      ),
      'POST /api/v1/submissions': (_) => reply({
        'id': 9,
        'status': 'pending_review',
        'questionId': 7,
      }, status: 201),
      'GET /api/v1/me/submissions/9': (_) => reply(
        ++checks == 1
            ? myPaperJson(9, analysis: 'processing', matches: null)
            : myPaperJson(9, status: 'published', autoPublished: true),
      ),
    });
    await pumpApp(
      tester,
      backend: backend,
      tokens: MemoryTokenStore('session.sig'),
      sources: FakePaperSources(pickedPdf()),
    );
    await openAccount(tester);

    await scrollTo(tester, find.widgetWithText(FilledButton, 'Share a paper'));
    await tester.tap(find.widgetWithText(FilledButton, 'Share a paper'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Choose a PDF'));
    await tester.pumpAndSettle();

    expect(find.text('ds-final.pdf'), findsOneWidget);
    // You share CSE papers, so the form starts there.
    expect(find.text('CSE · Computer Science and Engineering'), findsOneWidget);
    final upload = find.widgetWithText(FilledButton, 'Upload');
    expect(tester.widget<FilledButton>(upload).onPressed, isNull);

    await tester.tap(find.text('Choose…'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Data Structures'));
    await tester.pumpAndSettle();
    for (final choice in ['Final', 'Fall 25']) {
      await tester.ensureVisible(find.text(choice));
      await tester.pumpAndSettle();
      await tester.tap(find.text(choice));
      await tester.pump();
    }
    await tester.tap(upload);
    await settle(tester);

    final sent = backend.sent('POST /api/v1/submissions').single;
    expect(sent.headers['authorization'], 'Bearer session.sig');
    expect(Map.fromEntries((sent.data as FormData).fields), {
      'examTypeId': '1',
      'departmentId': '5',
      'courseId': '200',
      'semesterId': '1',
    });
    expect(find.text('Checking your paper'), findsOneWidget);

    // The page checks again every few seconds until the AI is done.
    await tester.pump(const Duration(seconds: 3));
    await settle(tester);
    expect(find.text('It’s live'), findsOneWidget);
    expect(find.text('Published automatically'), findsOneWidget);
  });

  testWidgets("takes the AI's details when it read another semester", (
    tester,
  ) async {
    final backend = FakeBackend({
      ...signedIn(
        papers: [
          myPaperJson(
            4,
            matches: false,
            aiSemester: {'id': 2, 'name': 'Summer 25'},
          ),
        ],
      ),
      'GET /api/v1/me/submissions/4': (_) => reply(
        myPaperJson(
          4,
          matches: false,
          aiSemester: {'id': 2, 'name': 'Summer 25'},
        ),
      ),
      'PUT /api/v1/me/submissions/4/classification': (_) =>
          reply(myPaperJson(4, status: 'published', autoPublished: true)),
    });
    await pumpApp(
      tester,
      backend: backend,
      tokens: MemoryTokenStore('session.sig'),
    );
    await openAccount(tester);
    await scrollTo(tester, find.text('Data Structures'));
    await tester.tap(find.text('Data Structures'));
    await tester.pumpAndSettle();

    expect(find.text('Check your details'), findsOneWidget);
    expect(find.text('AI read Summer 25'), findsOneWidget);
    await scrollTo(tester, find.text("Use the AI's details"));
    await tester.tap(find.text("Use the AI's details"));
    await tester.pumpAndSettle();

    final body =
        backend.sent('PUT /api/v1/me/submissions/4/classification').single.data
            as Map<String, Object?>;
    expect(body['semesterId'], 2);
    expect(body['courseId'], 200);
    expect(
      find.text(
        "Details updated. They match the AI's reading, so it's published.",
      ),
      findsOneWidget,
    );
  });

  testWidgets('withdraws a paper with several exams in one file', (
    tester,
  ) async {
    final flagged = myPaperJson(5, flag: 'multiple_papers', matches: null);
    final backend = FakeBackend({
      ...signedIn(papers: [flagged]),
      'GET /api/v1/me/submissions/5': (_) => reply(flagged),
      'DELETE /api/v1/me/submissions/5': (_) => reply(null, status: 204),
    });
    await pumpApp(
      tester,
      backend: backend,
      tokens: MemoryTokenStore('session.sig'),
    );
    await openAccount(tester);
    await scrollTo(tester, find.text('Data Structures'));
    await tester.tap(find.text('Data Structures'));
    await tester.pumpAndSettle();

    expect(find.text('Waiting for review'), findsWidgets);
    expect(find.text('Found 3 question papers in one file'), findsOneWidget);
    expect(find.text('Upload a paper'), findsOneWidget);
    await scrollTo(tester, find.text('Withdraw'));
    await tester.tap(find.text('Withdraw'));
    await tester.pumpAndSettle();
    expect(find.text('Withdraw this paper?'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Withdraw'));
    await tester.pumpAndSettle();

    expect(backend.sent('DELETE /api/v1/me/submissions/5'), hasLength(1));
    expect(find.text('Paper withdrawn'), findsOneWidget);
  });

  testWidgets('signed out, sharing asks to sign in first', (tester) async {
    await pumpApp(tester);
    await scrollTo(tester, find.text('Just sat an exam?'));

    await tester.tap(find.widgetWithText(FilledButton, 'Share a paper'));
    await tester.pumpAndSettle();

    expect(find.text('Sign in to share papers'), findsOneWidget);
  });

  testWidgets('says when a PDF is over the limit', (tester) async {
    await pumpApp(
      tester,
      backend: FakeBackend(signedIn()),
      tokens: MemoryTokenStore('session.sig'),
      sources: FakePaperSources(pickedPdf(bytes: 24 * 1024 * 1024)),
    );
    await scrollTo(tester, find.text('Just sat an exam?'));
    await tester.tap(find.widgetWithText(FilledButton, 'Share a paper'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Choose a PDF'));
    await tester.pumpAndSettle();

    expect(find.textContaining('This PDF is 24.0 MB'), findsOneWidget);
    expect(find.text('ds-final.pdf'), findsNothing);
  });
}
