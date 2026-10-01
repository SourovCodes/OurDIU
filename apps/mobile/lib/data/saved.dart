import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/generated/export.dart';
import 'prefs.dart';

/// Papers the reader bookmarked, newest first, kept on the device.
class SavedQuestions extends Notifier<List<Question>> {
  static const _key = 'saved_questions';

  @override
  List<Question> build() {
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

  void toggle(Question question) {
    state = contains(question.id)
        ? [
            for (final q in state)
              if (q.id != question.id) q,
          ]
        : [question, ...state];
    ref.read(prefsProvider).setStringList(_key, [
      for (final q in state) jsonEncode(q),
    ]);
  }
}

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
);
