import 'package:diuqbank/api/generated/export.dart';
import 'package:diuqbank/auth/token.dart';
import 'package:diuqbank/features/questions/engagement.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'app_harness.dart';
import 'fixtures.dart';

Future<void> openPaper(
  WidgetTester tester, {
  required FakeBackend backend,
  List<Submission>? papers,
  String? token = 'session.sig',
}) async {
  await pumpApp(
    tester,
    backend: backend,
    tokens: MemoryTokenStore(token),
    questions: (_) async => questionDetail(papers ?? [submission(1, likes: 3)]),
  );
  await scrollTo(tester, find.text('Structured Programming'));
  await tester.tap(find.text('Structured Programming'));
  await tester.pumpAndSettle();
}

Reply Function(dynamic) voteReply(int likes, int? myVote) =>
    (_) => reply({
      'likeCount': likes,
      'dislikeCount': 0,
      'viewCount': 0,
      'myVote': myVote,
    });

Map<String, Reply Function(dynamic)> signedIn({
  List<Map<String, Object?>> votes = const [],
  List<int> reported = const [],
}) => {
  'GET /api/v1/me': (_) => reply(profileJson()),
  // The question the test opens.
  'GET /api/v1/me/questions/21/interactions': (_) => reply({
    'userId': 'me',
    'votes': votes,
    'reportedSubmissionIds': reported,
  }),
};

Finder likeButton() => find.byWidgetPredicate(
  (w) => w is VoteButton && w.icon == Icons.thumb_up_outlined,
);

void main() {
  test('predicts the counts before the API answers', () {
    const liked = VoteResult(
      likeCount: 3,
      dislikeCount: 1,
      viewCount: 9,
      myVote: VoteValue.value1,
    );
    final disliked = expectedVote(liked, VoteValue.valueMinus1);
    expect(
      (disliked.likeCount, disliked.dislikeCount, disliked.myVote),
      (2, 2, VoteValue.valueMinus1),
    );
    final cleared = expectedVote(liked, null);
    expect((cleared.likeCount, cleared.myVote), (2, null));
  });

  testWidgets('likes a paper', (tester) async {
    final backend = FakeBackend({
      ...signedIn(),
      'PUT /api/v1/submissions/1/vote': voteReply(4, 1),
    });
    await openPaper(tester, backend: backend);
    expect(
      find.descendant(of: likeButton(), matching: find.text('3')),
      findsOneWidget,
    );

    await tester.tap(likeButton());
    await tester.pumpAndSettle();

    final vote = backend.sent('PUT /api/v1/submissions/1/vote').single;
    expect(vote.data, {'value': 1});
    expect(vote.headers['authorization'], 'Bearer session.sig');
    expect(
      find.descendant(of: likeButton(), matching: find.text('4')),
      findsOneWidget,
    );
    expect(tester.widget<VoteButton>(likeButton()).selected, isTrue);
  });

  testWidgets('takes back a like you already gave', (tester) async {
    final backend = FakeBackend({
      ...signedIn(
        votes: [
          {'submissionId': 1, 'value': 1},
        ],
      ),
      'DELETE /api/v1/submissions/1/vote': voteReply(2, null),
    });
    await openPaper(tester, backend: backend);
    expect(tester.widget<VoteButton>(likeButton()).selected, isTrue);

    await tester.tap(likeButton());
    await tester.pumpAndSettle();

    expect(backend.sent('DELETE /api/v1/submissions/1/vote'), hasLength(1));
    expect(tester.widget<VoteButton>(likeButton()).selected, isFalse);
    expect(
      find.descendant(of: likeButton(), matching: find.text('2')),
      findsOneWidget,
    );
  });

  testWidgets('signed out, a like signs in first and then counts', (
    tester,
  ) async {
    final backend = FakeBackend({
      ...signedIn(),
      'POST /api/auth/sign-in/social': (_) =>
          reply({'redirect': false}, headers: {'set-auth-token': 'new.sig'}),
      'PUT /api/v1/submissions/1/vote': voteReply(4, 1),
    });
    await openPaper(tester, backend: backend, token: null);

    await tester.tap(likeButton());
    await tester.pumpAndSettle();
    expect(find.text('Sign in to like papers'), findsOneWidget);
    await tester.tap(find.text('Continue with Google'));
    await tester.pumpAndSettle();

    final vote = backend.sent('PUT /api/v1/submissions/1/vote').single;
    expect(vote.headers['authorization'], 'Bearer new.sig');
    expect(
      find.descendant(of: likeButton(), matching: find.text('4')),
      findsOneWidget,
    );
  });

  testWidgets('"Not now" leaves the paper as it was', (tester) async {
    final backend = FakeBackend(signedIn());
    await openPaper(tester, backend: backend, token: null);

    await tester.tap(likeButton());
    await tester.pumpAndSettle();
    await tester.tap(find.text('Not now'));
    await tester.pumpAndSettle();

    expect(backend.requests, isEmpty);
    expect(
      find.descendant(of: likeButton(), matching: find.text('3')),
      findsOneWidget,
    );
  });

  testWidgets('puts the count back when the vote fails', (tester) async {
    final backend = FakeBackend({
      ...signedIn(),
      'PUT /api/v1/submissions/1/vote': (_) => reply({
        'error': {'code': 'RATE_LIMITED', 'message': 'Too fast'},
      }, status: 429),
    });
    await openPaper(tester, backend: backend);

    await tester.tap(likeButton());
    await tester.pumpAndSettle();

    expect(
      find.descendant(of: likeButton(), matching: find.text('3')),
      findsOneWidget,
    );
    expect(
      find.text("You're voting too fast. Please wait a minute."),
      findsOneWidget,
    );
  });

  testWidgets('reports a problem from the menu', (tester) async {
    final backend = FakeBackend({
      ...signedIn(),
      'POST /api/v1/submissions/1/reports': (_) => reply({
        'id': 5,
        'status': 'open',
        'submissionHidden': false,
      }, status: 201),
    });
    await openPaper(tester, backend: backend);

    await tester.tap(find.byTooltip('More'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Report a problem'));
    await tester.pumpAndSettle();
    expect(find.text('Report this paper'), findsOneWidget);

    await tester.tap(find.text('Something else'));
    await tester.pumpAndSettle();
    final send = find.widgetWithText(FilledButton, 'Send report');
    expect(tester.widget<FilledButton>(send).onPressed, isNull);
    await tester.enterText(find.byType(TextField), 'Page 2 is missing');
    await tester.pumpAndSettle();
    await tester.tap(send);
    await tester.pumpAndSettle();

    expect(backend.sent('POST /api/v1/submissions/1/reports').single.data, {
      'reason': 'other',
      'details': 'Page 2 is missing',
    });
    expect(
      find.text('Report sent. An admin will take a look.'),
      findsOneWidget,
    );
    await tester.tap(find.byTooltip('More'));
    await tester.pumpAndSettle();
    expect(find.text('You reported this paper'), findsOneWidget);
  });

  testWidgets("your own paper can't be liked or reported", (tester) async {
    final backend = FakeBackend(signedIn());
    await openPaper(
      tester,
      backend: backend,
      papers: [
        submission(
          1,
          uploader: const Uploader(
            id: 'me',
            username: 'nusrat',
            name: 'Nusrat Jahan',
            image: null,
          ),
        ),
      ],
    );

    expect(tester.widget<VoteButton>(likeButton()).onPressed, isNull);
    await tester.tap(find.byTooltip('More'));
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<PopupMenuItem<Object?>>(
            find.ancestor(
              of: find.text('Report a problem'),
              matching: find.byWidgetPredicate((w) => w is PopupMenuItem),
            ),
          )
          .enabled,
      isFalse,
    );
  });
}
