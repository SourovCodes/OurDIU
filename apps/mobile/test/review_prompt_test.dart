import 'package:diuqbank/data/review_prompt.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late SharedPreferences prefs;
  late DateTime now;
  late int asked;

  ReviewPrompt prompt({bool android = true}) => ReviewPrompt(
    prefs,
    now: () => now,
    android: android,
    request: () async => asked++,
    delay: Duration.zero,
  );

  /// [papers] opened on each of [days] days, a day apart.
  void use(int days, int papers) {
    for (var d = 0; d < days; d++) {
      for (var p = 0; p < papers; p++) {
        prompt().paperOpened();
      }
      now = now.add(const Duration(days: 1));
    }
  }

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    now = DateTime(2026, 10, 1, 12);
    asked = 0;
  });

  test('asks a regular reader who saves a paper, once in 120 days', () async {
    use(2, 3);
    now = now.add(const Duration(days: 7));
    await prompt().paperSaved();
    expect(asked, 1);

    // Saving again soon after doesn't ask again.
    now = now.add(const Duration(days: 30));
    await prompt().paperSaved();
    expect(asked, 1);

    now = now.add(const Duration(days: 90));
    await prompt().paperSaved();
    expect(asked, 2);
  });

  test('waits for 5 papers on 2 days', () async {
    // Many papers, but all on one day.
    use(1, 10);
    now = now.add(const Duration(days: 10));
    await prompt().paperSaved();
    expect(asked, 0);

    // Two days, but only 4 papers.
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    use(2, 2);
    now = now.add(const Duration(days: 10));
    await prompt().paperSaved();
    expect(asked, 0);
  });

  test('waits a week after first use', () async {
    use(2, 3);
    await prompt().paperSaved();
    expect(asked, 0);
    now = now.add(const Duration(days: 5));
    await prompt().paperSaved();
    expect(asked, 1);
  });

  test('never asks outside Android', () async {
    use(3, 5);
    now = now.add(const Duration(days: 10));
    await prompt(android: false).paperSaved();
    expect(asked, 0);
  });
}
