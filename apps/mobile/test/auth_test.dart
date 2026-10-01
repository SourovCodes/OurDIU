import 'package:diuqbank/api/api.dart';
import 'package:diuqbank/auth/token.dart';
import 'package:diuqbank/features/account/account_screen.dart';
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

FakeBackend signedInBackend() => FakeBackend({
  'POST /api/auth/sign-in/social': (_) =>
      reply({'redirect': false}, headers: {'set-auth-token': 'session.sig'}),
  'GET /api/v1/me': (_) => reply(profileJson()),
  'POST /api/auth/sign-out': (_) => reply({'success': true}),
});

void main() {
  test('sends the session token only to routes that act as you', () {
    expect(needsSession('/api/v1/me'), isTrue);
    expect(needsSession('/api/v1/me/questions/7/interactions'), isTrue);
    expect(needsSession('/api/v1/submissions/3/vote'), isTrue);
    expect(needsSession('/api/v1/submissions/3/reports'), isTrue);
    expect(needsSession('/api/v1/questions/7'), isFalse);
    expect(needsSession('/api/v1/submissions/3/views'), isFalse);
  });

  testWidgets('signs in with Google and shows your profile', (tester) async {
    final backend = signedInBackend();
    final tokens = MemoryTokenStore();
    await pumpApp(tester, backend: backend, tokens: tokens);
    await openAccount(tester);

    await tester.tap(find.text('Continue with Google'));
    await tester.pumpAndSettle();

    final signIn = backend.sent('POST /api/auth/sign-in/social').single;
    expect(signIn.data, {
      'provider': 'google',
      'idToken': {'token': 'google-id-token'},
    });
    expect(tokens.token, 'session.sig');
    expect(
      backend.sent('GET /api/v1/me').single.headers['authorization'],
      'Bearer session.sig',
    );
    expect(find.text('Nusrat Jahan'), findsOneWidget);
    expect(find.text('@nusrat'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(find.text('papers shared'), findsOneWidget);
    expect(find.text('4,180'), findsOneWidget);
    expect(find.text('Signed in as Nusrat Jahan'), findsOneWidget);
  });

  testWidgets('explains why a new non-DIU account is refused', (tester) async {
    final google = FakeGoogleAccounts(email: 'someone@gmail.com');
    final backend = FakeBackend({
      'POST /api/auth/sign-in/social': (_) => reply({
        'code': 'EMAIL_DOMAIN_NOT_ALLOWED',
        'message': 'Only DIU email addresses can create an account',
      }, status: 403),
    });
    await pumpApp(tester, backend: backend, google: google);
    await openAccount(tester);

    await tester.tap(find.text('Continue with Google'));
    await tester.pumpAndSettle();

    expect(find.text('Use your DIU Google account'), findsOneWidget);
    expect(find.textContaining('someone@gmail.com'), findsOneWidget);
    expect(find.text('Choose another account'), findsOneWidget);
    // So the picker asks again instead of returning the same account.
    expect(google.forgotten, 1);
  });

  testWidgets('closing the picker changes nothing', (tester) async {
    final backend = signedInBackend();
    await pumpApp(
      tester,
      backend: backend,
      google: FakeGoogleAccounts()..email = null,
    );
    await openAccount(tester);

    await tester.tap(find.text('Continue with Google'));
    await tester.pumpAndSettle();

    expect(backend.requests, isEmpty);
    expect(find.text('Continue with Google'), findsOneWidget);
  });

  testWidgets('signs out after asking, ending the session on the API', (
    tester,
  ) async {
    final backend = signedInBackend();
    final tokens = MemoryTokenStore('session.sig');
    await pumpApp(tester, backend: backend, tokens: tokens);
    await openAccount(tester);
    expect(find.text('Nusrat Jahan'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Sign out'),
      200,
      scrollable: find
          .descendant(
            of: find.byType(AccountScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    expect(find.text('Sign out?'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Sign out'));
    await tester.pumpAndSettle();

    expect(tokens.token, isNull);
    expect(
      backend.sent('POST /api/auth/sign-out').single.headers['authorization'],
      'Bearer session.sig',
    );
    expect(find.text('Continue with Google'), findsOneWidget);
    expect(find.text('Signed out'), findsOneWidget);
  });

  testWidgets('a session that ended elsewhere signs the app out', (
    tester,
  ) async {
    final tokens = MemoryTokenStore('expired.sig');
    final backend = FakeBackend({
      'GET /api/v1/me': (_) => reply({
        'error': {'code': 'UNAUTHORIZED', 'message': 'You must be signed in'},
      }, status: 401),
    });
    await pumpApp(tester, backend: backend, tokens: tokens);
    await openAccount(tester);

    expect(tokens.token, isNull);
    expect(find.text('Continue with Google'), findsOneWidget);
  });
}
