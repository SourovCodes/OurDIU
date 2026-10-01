import 'package:diuqbank/data/prefs.dart';
import 'package:diuqbank/data/saved.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
}
