import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/api.dart';
import '../../api/generated/export.dart';

const questionsPageSize = 20;

/// One page (1-based) of the questions list, newest first. The list screen asks for
/// pages as it scrolls; pull-to-refresh invalidates them all.
final questionsPageProvider = FutureProvider.family<QuestionList, int>(
  (ref, page) => ref
      .watch(qbApiProvider)
      .questions
      .getApiV1Questions(page: page, pageSize: questionsPageSize),
);
