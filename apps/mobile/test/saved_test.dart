import 'dart:convert';

import 'package:diuqbank/api/api.dart';
import 'package:diuqbank/api/generated/export.dart';
import 'package:diuqbank/auth/token.dart';
import 'package:diuqbank/data/prefs.dart';
import 'package:diuqbank/data/saved.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_harness.dart';
import 'fixtures.dart';

void main() {
  test('saves papers on the device, newest first', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    ProviderContainer container() =>
        ProviderContainer(overrides: [prefsProvider.overrideWithValue(prefs)]);

    final first = container();
    first.read(savedQuestionsProvider.notifier)
      ..toggle(question(1))
      ..toggle(question(2))
      ..toggle(question(1))
      ..toggle(question(3));
    expect(first.read(savedQuestionsProvider).map((q) => q.id), [3, 2]);

    // A fresh start (like reopening the app) reads them back.
    expect(container().read(savedQuestionsProvider).map((q) => q.id), [3, 2]);
  });

  syncTests();
}

Map<String, Object?> savedJson(Question q) => {
  ...jsonDecode(jsonEncode(q)) as Map<String, Object?>,
  'savedAt': '2026-10-02T10:00:00.000Z',
};

void syncTests() {
  test('merges the phone’s list into the account when signed in', () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final backend = FakeBackend({
      'POST /api/v1/me/saved': (_) => reply({
        'items': [savedJson(question(9)), savedJson(question(1))],
      }),
      'DELETE /api/v1/me/saved/2': (_) => reply(null, status: 204),
    });
    final container = ProviderContainer(
      overrides: [
        prefsProvider.overrideWithValue(prefs),
        httpAdapterProvider.overrideWithValue(backend),
      ],
    );
    addTearDown(container.dispose);

    // Signed out: only on the phone.
    final saved = container.read(savedQuestionsProvider.notifier)
      ..toggle(question(1))
      ..toggle(question(2))
      ..toggle(question(2));
    expect(backend.requests, isEmpty);

    await container.read(sessionTokenProvider.notifier).set('token');
    await saved.sync();

    // The removal made offline went first, then the phone's list was merged and
    // the account's (which also has 9, saved on the website) came back.
    expect(backend.sent('DELETE /api/v1/me/saved/2'), hasLength(1));
    final body = backend.sent('POST /api/v1/me/saved').single.data;
    expect(jsonDecode(jsonEncode(body)), {
      'questionIds': [1],
    });
    expect(container.read(savedQuestionsProvider).map((q) => q.id), [9, 1]);
  });
}
