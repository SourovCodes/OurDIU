import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_harness.dart';

void main() {
  testWidgets('first launch asks what you need, then remembers it', (
    tester,
  ) async {
    await pumpApp(tester, prefs: const {});

    expect(find.text('What do you need?'), findsOneWidget);
    expect(find.text('Coming soon'), findsNWidgets(2));
    await tester.tap(find.text('Question papers'));
    await tester.pumpAndSettle();

    expect(find.text('Find your paper'), findsOneWidget);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('space'), 'questions');
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

  testWidgets('the app reopens in the product used last', (tester) async {
    await pumpApp(tester, prefs: const {'space': 'market'});

    expect(
      find.bySemanticsLabel('Marketplace, switch product'),
      findsOneWidget,
    );
    expect(find.text('Coming soon'), findsOneWidget);
  });
}
