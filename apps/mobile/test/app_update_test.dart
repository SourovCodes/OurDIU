import 'package:diuqbank/data/app_update.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_harness.dart';

const _snackbar = 'Update downloaded. Restart to use the new version.';

void main() {
  test('compares versions, and never blocks on one it can\'t read', () {
    expect(isOlderVersion('1.5.9', '1.6.0'), isTrue);
    expect(isOlderVersion('1.10.0', '1.9.0'), isFalse);
    expect(isOlderVersion('1.6.0', '1.6.0'), isFalse);
    expect(isOlderVersion('2.0.0', '1.99.99'), isFalse);
    expect(isOlderVersion('1.6', '1.6.0'), isFalse);
    expect(isOlderVersion('1.6.0', 'soon'), isFalse);
  });

  testWidgets('a version older than the minimum only asks to be updated', (
    tester,
  ) async {
    final play = FakePlayUpdates(state: PlayUpdate.available);
    await pumpApp(
      tester,
      installedVersion: '1.5.0',
      minimumVersion: '1.6.0',
      play: play,
    );

    expect(find.text('Time to update OurDIU'), findsOneWidget);
    expect(find.text('Update on Google Play'), findsOneWidget);
    expect(find.text('Find your paper'), findsNothing);
    // Play isn't asked as well.
    expect(play.asked, 0);
  });

  testWidgets('Play downloads an update in the background, then the app '
      'offers to restart', (tester) async {
    final play = FakePlayUpdates(state: PlayUpdate.available);
    await pumpApp(tester, play: play);

    expect(play.asked, 1);
    expect(find.text('Find your paper'), findsOneWidget);
    expect(find.text(_snackbar), findsNothing);

    play.finishDownload();
    await tester.pumpAndSettle();
    expect(find.text(_snackbar), findsOneWidget);

    await tester.tap(find.text('Restart'));
    await tester.pumpAndSettle();
    expect(play.completed, isTrue);
  });

  testWidgets('an update downloaded earlier is offered at launch', (
    tester,
  ) async {
    await pumpApp(tester, play: FakePlayUpdates(state: PlayUpdate.downloaded));
    expect(find.text(_snackbar), findsOneWidget);
  });

  testWidgets('after "No thanks", Play isn\'t asked again for that version '
      'for a while', (tester) async {
    final declined = FakePlayUpdates(
      state: PlayUpdate.available,
      accept: false,
    );
    await pumpApp(tester, play: declined);
    expect(declined.asked, 1);
    expect(find.text(_snackbar), findsNothing);
    final saved = (await SharedPreferences.getInstance()).getString(
      'update_declined',
    );
    expect(saved, startsWith('1010000:'));

    // Next launch, same version: not asked. A newer version: asked again.
    for (final (code, asks) in [(1010000, 0), (1011000, 1)]) {
      final play = FakePlayUpdates(
        state: PlayUpdate.available,
        versionCode: code,
      );
      // A fresh launch: the app (and its one check per session) starts over.
      await tester.pumpWidget(const SizedBox());
      await pumpApp(
        tester,
        play: play,
        prefs: {'space': 'questions', 'update_declined': saved!},
      );
      expect(play.asked, asks, reason: 'version $code');
    }
  });
}
