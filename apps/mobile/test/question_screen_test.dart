import 'dart:convert';

import 'package:diuqbank/api/generated/export.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'app_harness.dart';
import 'fixtures.dart';

Future<FakeViewCounter> openQuestion(
  WidgetTester tester,
  QuestionDetail detail,
) async {
  final counter = await pumpApp(tester, questions: (_) async => detail);
  await scrollTo(tester, find.text('Structured Programming'));
  await tester.tap(find.text('Structured Programming'));
  await tester.pumpAndSettle();
  return counter;
}

void main() {
  testWidgets('opens the top-ranked published paper and counts the views', (
    tester,
  ) async {
    final counter = await openQuestion(
      tester,
      questionDetail([
        submission(5, status: SubmissionStatus.pendingReview),
        submission(1, batch: '61'),
        submission(2, uploader: uploader('Jane')),
      ]),
    );

    expect(find.text('Data Structures'), findsOneWidget);
    expect(find.text('CSE · Final · Fall 25'), findsOneWidget);
    expect(find.text('PDF https://files.example/1.pdf'), findsOneWidget);
    expect(find.text('Batch 61'), findsOneWidget);
    expect(find.text('Paper 1 of 2 · change'), findsOneWidget);
    expect(counter.views, ['question 7', 'paper 1']);
  });

  testWidgets('switches papers from the sheet and counts each once', (
    tester,
  ) async {
    final counter = await openQuestion(
      tester,
      questionDetail([
        submission(1, batch: '61'),
        submission(2, uploader: uploader('Jane')),
      ]),
    );

    await tester.tap(find.text('Paper 1 of 2 · change'));
    await tester.pumpAndSettle();
    expect(find.text('2 papers for this exam'), findsOneWidget);
    await tester.tap(find.text('By Jane'));
    await tester.pumpAndSettle();
    expect(find.text('PDF https://files.example/2.pdf'), findsOneWidget);
    expect(find.text('Paper 2 of 2 · change'), findsOneWidget);

    await tester.tap(find.text('Paper 2 of 2 · change'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Batch 61').last);
    await tester.pumpAndSettle();
    expect(counter.views, ['question 7', 'paper 1', 'paper 2']);
  });

  testWidgets('a tap on the page hides the bars', (tester) async {
    await openQuestion(tester, questionDetail([submission(1)]));
    final bar = find.byType(AnimatedSlide).first;
    expect(tester.widget<AnimatedSlide>(bar).offset, Offset.zero);

    await tester.tap(find.text('PDF https://files.example/1.pdf'));
    await tester.pumpAndSettle();
    expect(tester.widget<AnimatedSlide>(bar).offset, isNot(Offset.zero));
  });

  testWidgets('explains when no paper is published yet', (tester) async {
    final counter = await openQuestion(
      tester,
      questionDetail([
        submission(5, status: SubmissionStatus.pendingReview),
      ], pendingReview: 1),
    );

    expect(find.text('No published paper yet'), findsOneWidget);
    expect(
      find.textContaining('1 submission is waiting for review'),
      findsOneWidget,
    );
    expect(find.byTooltip('Share or save to Files'), findsNothing);
    expect(counter.views, ['question 7']);
  });

  test('reads papers whose uploader deleted their account', () {
    // Through JSON text, the way it arrives from the API.
    final json = jsonDecode(
      jsonEncode(questionDetail([submission(1)])),
    ) as Map<String, Object?>;
    ((json['submissions']! as List).single as Map)['uploader'] = null;

    final question = QuestionDetail.fromJson(json);
    expect(question.submissions.single.uploader, isNull);
  });
}
