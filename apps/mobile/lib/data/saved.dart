import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api.dart';
import '../api/generated/export.dart';
import '../auth/token.dart';
import 'prefs.dart';

/// Papers the reader bookmarked, newest first. Kept on the device, so saving works
/// offline and signed out; when signed in, the same list as the account's on the
/// website (`/api/v1/me/saved`).
class SavedQuestions extends Notifier<List<Question>> {
  static const _key = 'saved_questions';

  /// Removed on this phone but not yet on the account (offline at the time), so a
  /// sync doesn't bring them back.
  static const _removedKey = 'saved_questions_removed';

  @override
  List<Question> build() {
    // Signing in merges this phone's list into the account's.
    ref.listen(sessionTokenProvider, (previous, next) {
      if (next != null && next != previous) unawaited(sync());
    });
    if (ref.read(sessionTokenProvider) != null) {
      // After the first frame's state is set.
      Future.microtask(sync);
    }
    final raw = ref.watch(prefsProvider).getStringList(_key) ?? const [];
    return [for (final json in raw) ?_tryParse(json)];
  }

  Question? _tryParse(String json) {
    try {
      return Question.fromJson(jsonDecode(json) as Map<String, Object?>);
    } catch (_) {
      return null; // Saved by an older version with a different shape.
    }
  }

  bool contains(int id) => state.any((q) => q.id == id);

  void _store(List<Question> questions) {
    state = questions;
    ref.read(prefsProvider).setStringList(_key, [
      for (final q in questions) jsonEncode(q),
    ]);
  }

  Set<int> get _removed => {
    for (final id in ref.read(prefsProvider).getStringList(_removedKey) ?? [])
      ?int.tryParse(id),
  };

  void _setRemoved(Set<int> ids) => ref.read(prefsProvider).setStringList(
    _removedKey,
    [for (final id in ids) '$id'],
  );

  void toggle(Question question) {
    final saving = !contains(question.id);
    _store(
      saving
          ? [question, ...state]
          : [
              for (final q in state)
                if (q.id != question.id) q,
            ],
    );
    final removed = _removed;
    saving ? removed.remove(question.id) : removed.add(question.id);
    _setRemoved(removed);
    if (ref.read(sessionTokenProvider) == null) return;
    // Straight to the account too; if that fails, the next sync catches up.
    final saved = ref.read(qbApiProvider).saved;
    unawaited(
      (saving
              ? saved.putApiV1MeSavedId(id: question.id)
              : saved.deleteApiV1MeSavedId(id: question.id))
          .then((_) {
            if (!saving) _setRemoved(_removed..remove(question.id));
          })
          .catchError((Object _) {}),
    );
  }

  Future<void>? _syncing;

  /// Makes the phone's list and the account's the same: removals made offline go
  /// first, then the phone's papers are added to the account, and the account's
  /// list (newest first) replaces the phone's. Does nothing when signed out or
  /// offline. While one runs, calling again waits for it.
  Future<void> sync() =>
      _syncing ??= _sync().whenComplete(() => _syncing = null);

  Future<void> _sync() async {
    if (ref.read(sessionTokenProvider) == null) return;
    try {
      final saved = ref.read(qbApiProvider).saved;
      for (final id in _removed) {
        await saved.deleteApiV1MeSavedId(id: id);
        _setRemoved(_removed..remove(id));
      }
      final local = [for (final q in state) q.id];
      final list = local.isEmpty
          ? await saved.getApiV1MeSaved()
          : await saved.postApiV1MeSaved(
              body: SaveQuestionsInput(questionIds: local),
            );
      _store([for (final s in list.items) _summary(s)]);
    } catch (_) {
      // Offline or signed out meanwhile: the phone's list stays as it is.
    }
  }
}

Question _summary(SavedQuestion s) => Question(
  id: s.id,
  department: s.department,
  course: s.course,
  semester: s.semester,
  examType: s.examType,
  submissionCounts: s.submissionCounts,
  viewCount: s.viewCount,
  // Kept on the phone, where today's count would go stale.
  viewsToday: null,
);

final savedQuestionsProvider = NotifierProvider<SavedQuestions, List<Question>>(
  SavedQuestions.new,
);

/// The list row for a loaded question, as saved and listed.
Question summaryOf(QuestionDetail q) => Question(
  id: q.id,
  department: q.department,
  course: q.course,
  semester: q.semester,
  examType: q.examType,
  submissionCounts: q.submissionCounts,
  viewCount: q.viewCount,
  viewsToday: null,
);
