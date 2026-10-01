import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api.dart';
import '../api/generated/export.dart';

/// Which questions a list shows.
typedef QuestionQuery = ({QuestionSort sort, int? courseId, int pageSize});

const newestQuestions = (
  sort: QuestionSort.newest,
  courseId: null,
  pageSize: 20,
);
const popularQuestions = (
  sort: QuestionSort.popular,
  courseId: null,
  pageSize: 20,
);

/// Every exam of a course in one request (the API allows 100 per page; no course
/// comes close).
QuestionQuery courseQuestions(int courseId) =>
    (sort: QuestionSort.newest, courseId: courseId, pageSize: 100);

/// One page (1-based) of a question list.
final questionPageProvider =
    FutureProvider.family<QuestionList, (QuestionQuery, int)>((ref, key) {
      final (query, page) = key;
      return ref
          .watch(qbApiProvider)
          .questions
          .getApiV1Questions(
            sort: query.sort,
            courseId: query.courseId,
            page: page,
            pageSize: query.pageSize,
          );
    });
