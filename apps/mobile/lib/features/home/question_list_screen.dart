import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/format.dart';
import '../../data/questions.dart';
import '../../theme/exam_shape.dart';
import '../../widgets/question_row.dart';
import '../../widgets/skeleton.dart';
import '../../widgets/state_message.dart';

/// The lists Home's "See all" opens, by the route's `which`.
enum HomeList {
  newest('Recently added', newestQuestions),
  popular('Most viewed', popularQuestions),
  trending('Most viewed today', trendingQuestions);

  const HomeList(this.title, this.query);

  final String title;
  final QuestionQuery query;

  /// `newest` for anything unknown.
  static HomeList named(String? which) =>
      values.firstWhere((l) => l.name == which, orElse: () => newest);
}

/// "See all" from Home: every question, most viewed (today or ever) or newest
/// first, loading pages as the list scrolls.
class QuestionListScreen extends ConsumerWidget {
  const QuestionListScreen({super.key, required this.list});

  final HomeList list;

  QuestionQuery get _query => list.query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final first = ref.watch(questionPageProvider((_query, 1)));
    return Scaffold(
      appBar: AppBar(title: Text(list.title)),
      body: switch (first) {
        AsyncData(:final value) => RefreshIndicator(
          onRefresh: () {
            ref.invalidate(questionPageProvider);
            return ref.read(questionPageProvider((_query, 1)).future);
          },
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            itemCount: value.total,
            separatorBuilder: (_, _) => const SizedBox(height: 2),
            itemBuilder: (context, i) => ClipRRect(
              borderRadius: BorderRadius.circular(
                i == 0 || i == value.total - 1 ? 20 : 4,
              ),
              child: _PagedRow(query: _query, index: i),
            ),
          ),
        ),
        AsyncError(:final error) => StateMessage(
          icon: isOffline(error)
              ? Icons.cloud_off_rounded
              : Icons.error_outline_rounded,
          shape: ExamKind.midterm,
          title: isOffline(error) ? "You're offline" : "Couldn't load papers",
          body: isOffline(error)
              ? 'Connect to the internet and try again.'
              : 'Something went wrong on our side. Please try again.',
          actions: [
            FilledButton(
              onPressed: () => ref.invalidate(questionPageProvider),
              child: const Text('Try again'),
            ),
          ],
        ),
        _ => const Skeleton(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [RowBone(), RowBone(), RowBone(), RowBone()],
            ),
          ),
        ),
      },
    );
  }
}

/// Row [index] of the whole list, read from the page it falls on.
class _PagedRow extends ConsumerWidget {
  const _PagedRow({required this.query, required this.index});

  final QuestionQuery query;
  final int index;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = index ~/ query.pageSize + 1;
    final offset = index % query.pageSize;
    return switch (ref.watch(questionPageProvider((query, page)))) {
      AsyncData(:final value) when offset < value.items.length => QuestionRow(
        value.items[offset],
      ),
      AsyncData() => const SizedBox.shrink(),
      AsyncError() when offset == 0 => ListTile(
        title: const Text("Couldn't load more papers."),
        trailing: TextButton(
          onPressed: () => ref.invalidate(questionPageProvider((query, page))),
          child: const Text('Retry'),
        ),
      ),
      AsyncError() => const SizedBox.shrink(),
      _ => const Skeleton(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: RowBone(),
        ),
      ),
    };
  }
}
