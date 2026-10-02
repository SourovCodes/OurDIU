import 'package:diuqbank/auth/token.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'app_harness.dart';
import 'fixtures.dart';
import 'upload_flow_test.dart' show openAccount, pickedPdf;

const asked = 'Some pages are missing. Please replace the file.';

/// A paper a reviewer sent back, kept as the fake API changes it.
class SentBack {
  var status = 'changes_requested';
  var unread = 1;
  final messages = [
    reviewMessageJson(1, kind: 'changes_requested', body: asked),
  ];

  Map<String, Object?> json() => myPaperJson(
    4,
    status: status,
    changesRequested: status == 'changes_requested' ? asked : null,
    unread: unread,
    messages: messages,
  );

  Map<String, Reply Function(RequestOptions)> routes() => {
    'GET /api/v1/me': (_) => reply(profileJson()),
    'GET /api/v1/me/submissions': (_) => reply({
      'items': [json()],
    }),
    'GET /api/v1/me/review-activity': (_) => reply({
      'needsAttention': status == 'changes_requested' || unread > 0 ? 1 : 0,
    }),
    'GET /api/v1/me/submissions/4': (_) {
      final paper = json();
      unread = 0;
      return reply(paper);
    },
    'POST /api/v1/me/submissions/4/messages': (r) {
      messages.add(
        reviewMessageJson(
          messages.length + 1,
          role: 'uploader',
          body: (r.data as Map)['body'] as String,
        ),
      );
      return reply(json(), status: 201);
    },
    'PUT /api/v1/me/submissions/4/file': (_) {
      messages.add(
        reviewMessageJson(
          messages.length + 1,
          kind: 'file_replaced',
          role: 'uploader',
        ),
      );
      return reply(json());
    },
    'POST /api/v1/me/submissions/4/resubmit': (r) {
      status = 'pending_review';
      messages.add(
        reviewMessageJson(
          messages.length + 1,
          kind: 'resubmitted',
          role: 'uploader',
          body: (r.data as Map)['note'] as String?,
        ),
      );
      return reply(json());
    },
  };
}

void main() {
  testWidgets('a paper sent back: badge, request, reply, new file, resubmit', (
    tester,
  ) async {
    final paper = SentBack();
    final backend = FakeBackend(paper.routes());
    await pumpApp(
      tester,
      backend: backend,
      tokens: MemoryTokenStore('session.sig'),
      sources: FakePaperSources(pickedPdf()),
    );

    // The Account tab says a paper needs you.
    expect(
      find.descendant(of: find.byType(NavigationBar), matching: find.text('1')),
      findsOneWidget,
    );
    await openAccount(tester);
    expect(find.text('Needs changes'), findsOneWidget);
    expect(find.text('1 new'), findsOneWidget);

    await tester.tap(find.text('Data Structures'));
    await tester.pumpAndSettle();
    expect(find.text('Needs your changes'), findsOneWidget);
    // Quoted in the hero, and in the messages below it.
    expect(find.text(asked), findsNWidgets(2));
    expect(find.text('New'), findsOneWidget);

    // A question for the reviewer.
    await tester.tap(find.text('Reply'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Reviewer asked for changes', findRichText: true),
      findsOneWidget,
    );
    await tester.enterText(find.byType(TextField), 'Is page 4 needed?');
    await tester.tap(find.byTooltip('Send'));
    await tester.pumpAndSettle();
    expect(
      backend.sent('POST /api/v1/me/submissions/4/messages'),
      hasLength(1),
    );
    expect(find.text('Is page 4 needed?'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();

    // A clearer file.
    await tester.tap(find.text('Replace file'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Choose a PDF'));
    await tester.pumpAndSettle();
    expect(find.text('ds-final.pdf'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Replace'));
    await tester.pumpAndSettle();
    expect(backend.sent('PUT /api/v1/me/submissions/4/file'), hasLength(1));
    expect(
      find.text('File replaced. Resubmit when you’re ready.'),
      findsOneWidget,
    );

    // Back to the reviewer, with a note.
    await tester.tap(find.text('Resubmit for review'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Added the last page.');
    await tester.tap(find.widgetWithText(FilledButton, 'Resubmit'));
    await tester.pumpAndSettle();
    expect(backend.sent('POST /api/v1/me/submissions/4/resubmit').single.data, {
      'note': 'Added the last page.',
    });
    expect(find.text('Sent back for review'), findsOneWidget);
    expect(find.text('Waiting for review'), findsWidgets);
    expect(find.text('Resubmit for review'), findsNothing);
  });

  testWidgets('a published paper has no reply box', (tester) async {
    final published = myPaperJson(
      6,
      status: 'published',
      messages: [reviewMessageJson(1, kind: 'published')],
    );
    final backend = FakeBackend({
      'GET /api/v1/me': (_) => reply(profileJson()),
      'GET /api/v1/me/submissions': (_) => reply({
        'items': [published],
      }),
      'GET /api/v1/me/submissions/6': (_) => reply(published),
    });
    await pumpApp(
      tester,
      backend: backend,
      tokens: MemoryTokenStore('session.sig'),
    );
    await openAccount(tester);
    await tester.tap(find.text('Data Structures'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Open'));
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Reviewer published the paper', findRichText: true),
      findsOneWidget,
    );
    expect(find.byType(TextField), findsNothing);
  });
}
