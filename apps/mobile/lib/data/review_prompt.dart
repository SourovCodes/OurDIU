import 'dart:async';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_review/in_app_review.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'prefs.dart';

/// Asks for a Google Play rating when a regular reader saves a paper
/// (docs/PLAN.md, decision 64). Play draws its own card and decides whether it
/// shows at all; there's no question of ours before it, as Play's policy asks.
class ReviewPrompt {
  ReviewPrompt(
    this._prefs, {
    DateTime Function()? now,
    bool? android,
    Future<void> Function()? request,
    this.delay = const Duration(seconds: 1),
  }) : _now = now ?? DateTime.now,
       _android = android ?? Platform.isAndroid,
       _request = request ?? _requestReview;

  final SharedPreferences _prefs;
  final DateTime Function() _now;
  final bool _android;
  final Future<void> Function() _request;

  /// After the save's snack bar, so the card doesn't land mid-tap.
  final Duration delay;

  static const minPapers = 5;
  static const minDays = 2;
  static const sinceFirstUse = Duration(days: 7);
  static const betweenAsks = Duration(days: 120);

  static const _papersKey = 'review_papers_opened';
  static const _daysKey = 'review_days_used';
  static const _lastDayKey = 'review_last_day';
  static const _firstSeenKey = 'review_first_seen';
  static const _lastAskedKey = 'review_last_asked';

  /// A paper was opened in the reader (each one once per visit).
  void paperOpened() {
    final now = _now();
    _prefs.setInt(_papersKey, (_prefs.getInt(_papersKey) ?? 0) + 1);
    if (!_prefs.containsKey(_firstSeenKey)) {
      _prefs.setInt(_firstSeenKey, now.millisecondsSinceEpoch);
    }
    final today = _day(now);
    if (_prefs.getString(_lastDayKey) != today) {
      _prefs
        ..setString(_lastDayKey, today)
        ..setInt(_daysKey, (_prefs.getInt(_daysKey) ?? 0) + 1);
    }
  }

  /// Whether saving a paper now should ask.
  bool get due {
    if (!_android) return false;
    final firstSeen = _prefs.getInt(_firstSeenKey);
    if (firstSeen == null ||
        (_prefs.getInt(_papersKey) ?? 0) < minPapers ||
        (_prefs.getInt(_daysKey) ?? 0) < minDays) {
      return false;
    }
    final now = _now();
    if (now.difference(_at(firstSeen)) < sinceFirstUse) return false;
    final lastAsked = _prefs.getInt(_lastAskedKey);
    return lastAsked == null || now.difference(_at(lastAsked)) >= betweenAsks;
  }

  /// A paper was saved: asks for a rating if [due].
  Future<void> paperSaved() async {
    if (!due) return;
    // Counted as asked even if Play shows nothing: it keeps its own limits.
    await _prefs.setInt(_lastAskedKey, _now().millisecondsSinceEpoch);
    await Future<void>.delayed(delay);
    try {
      await _request();
    } catch (_) {
      // No Play Store on this phone, or Play said no: nothing to do.
    }
  }

  static DateTime _at(int ms) => DateTime.fromMillisecondsSinceEpoch(ms);

  static String _day(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';
}

Future<void> _requestReview() async {
  final review = InAppReview.instance;
  if (await review.isAvailable()) await review.requestReview();
}

final reviewPromptProvider = Provider<ReviewPrompt>(
  (ref) => ReviewPrompt(ref.watch(prefsProvider)),
);
