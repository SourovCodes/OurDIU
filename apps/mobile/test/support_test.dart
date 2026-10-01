import 'package:diuqbank/auth/token.dart';
import 'package:diuqbank/data/support.dart';
import 'package:flutter_test/flutter_test.dart';

import 'app_harness.dart';
import 'auth_test.dart' show openAccount, signedInBackend;

void main() {
  test('a feedback email carries the app version and the phone', () {
    final uri = feedbackEmail(
      const AppDetails(
        version: '1.5.0',
        build: '1005000',
        device: 'samsung SM-S921B, Android 16 (SDK 36)',
      ),
    );
    expect(uri.scheme, 'mailto');
    expect(uri.path, supportEmail);
    expect(uri.toString(), contains('subject=QuestionBank%20app%20feedback'));
    expect(uri.toString(), isNot(contains('+')));
    expect(
      Uri.decodeComponent(uri.toString().split('body=').last),
      '\n\n—\nApp 1.5.0 (1005000)\nsamsung SM-S921B, Android 16 (SDK 36)',
    );
  });

  test('without the details, the email still opens', () {
    expect(
      Uri.decodeComponent(feedbackEmail(null).toString().split('body=').last),
      '\n\n—',
    );
  });

  testWidgets('Account offers rating, feedback and account deletion', (
    tester,
  ) async {
    await pumpApp(
      tester,
      backend: signedInBackend(),
      tokens: MemoryTokenStore('session.sig'),
    );
    await openAccount(tester);

    for (final label in ['Rate QuestionBank', 'Send feedback']) {
      await scrollTo(tester, find.text(label));
      expect(find.text(label), findsOneWidget);
    }
    await scrollTo(tester, find.text('Delete account'));
    expect(find.text('Delete account'), findsOneWidget);
  });

  testWidgets('Delete account is only offered when signed in', (tester) async {
    await pumpApp(tester);
    await openAccount(tester);
    await scrollTo(tester, find.text('Send feedback'));
    expect(find.text('Delete account'), findsNothing);
  });
}
