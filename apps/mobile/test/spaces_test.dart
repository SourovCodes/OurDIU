import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_harness.dart';

void main() {
  testWidgets('first launch opens the Question Bank, without the chooser', (
    tester,
  ) async {
    await pumpApp(tester, prefs: const {});

    expect(find.text('What do you need?'), findsNothing);
    expect(find.text('Find your paper'), findsOneWidget);
  });

  testWidgets('the product name switches to a coming-soon product and back', (
    tester,
  ) async {
    await pumpApp(tester);

    await tester.tap(find.bySemanticsLabel('Question Bank, switch product'));
    await tester.pumpAndSettle();
    expect(find.text('Switch to'), findsOneWidget);
    expect(find.text("You're here"), findsOneWidget);

    await tester.tap(find.text('Class Routine'));
    await tester.pumpAndSettle();
    expect(find.text('Coming soon'), findsOneWidget);
    // The routine's space has no question bank tabs.
    expect(find.byType(NavigationBar), findsNothing);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('space'), 'routine');

    await tester.tap(find.text('Open the Question Bank'));
    await tester.pumpAndSettle();
    expect(find.text('Find your paper'), findsOneWidget);
    expect(prefs.getString('space'), 'questions');
  });

  testWidgets('a coming-soon product used last reopens in the Question Bank', (
    tester,
  ) async {
    await pumpApp(tester, prefs: const {'space': 'market'});

    expect(find.text('Find your paper'), findsOneWidget);
    expect(
      find.bySemanticsLabel('Question Bank, switch product'),
      findsOneWidget,
    );
  });
}
