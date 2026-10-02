import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/generated/export.dart';
import '../../auth/session.dart';
import '../../data/format.dart';
import '../../data/questions.dart';
import '../../data/settings.dart';
import '../../data/taxonomy.dart';
import '../../theme/exam_shape.dart';
import '../../theme/theme.dart';
import '../../widgets/avatar.dart';
import '../../widgets/question_row.dart';
import '../../widgets/section_header.dart';
import '../../widgets/skeleton.dart';
import '../../widgets/state_message.dart';
import '../upload/share_card.dart';
import '../../spaces/space.dart';
import '../../spaces/switcher.dart';
import '../../data/contributors.dart';
import '../contributors/contributors_screen.dart';
import 'search_pill.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref
      ..invalidate(taxonomyProvider)
      ..invalidate(questionPageProvider);
    await ref.read(questionPageProvider((newestQuestions, 1)).future);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final taxonomy = ref.watch(taxonomyProvider);
    final popular = ref.watch(questionPageProvider((popularQuestions, 1)));
    final newest = ref.watch(questionPageProvider((newestQuestions, 1)));

    final error = [
      taxonomy,
      popular,
      newest,
    ].map((a) => a.error).whereType<Object>().firstOrNull;
    final Widget body;
    if (error != null && !(newest.hasValue && popular.hasValue)) {
      body = isOffline(error)
          ? StateMessage(
              icon: Icons.cloud_off_rounded,
              shape: ExamKind.midterm,
              title: "You're offline",
              body:
                  'Connect to the internet to browse papers. Your saved list '
                  'is still here.',
              actions: [
                FilledButton.icon(
                  onPressed: () => _refresh(ref),
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Try again'),
                ),
                FilledButton.tonal(
                  onPressed: () => context.go('/saved'),
                  child: const Text('Open saved'),
                ),
              ],
            )
          : StateMessage(
              icon: Icons.error_outline_rounded,
              shape: ExamKind.midterm,
              title: "Couldn't load papers",
              body: 'Something went wrong on our side. Please try again.',
              actions: [
                FilledButton(
                  onPressed: () => _refresh(ref),
                  child: const Text('Try again'),
                ),
              ],
            );
    } else if (!newest.hasValue || !popular.hasValue) {
      body = const _HomeSkeleton();
    } else {
      body = RefreshIndicator(
        onRefresh: () => _refresh(ref),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            const _Masthead(),
            const SizedBox(height: 20),
            Text(
              'Find your paper',
              style: expressive(
                44,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
            const SizedBox(height: 20),
            SearchPill(
              label: switch (taxonomy.value) {
                final t? => 'Search ${thousands(t.courses.length)} courses',
                null => 'Search courses',
              },
              onTap: () => context.push('/home/search'),
            ),
            if (taxonomy.value case final t?) ...[
              const SizedBox(height: 16),
              _DepartmentChips(departments: t.departments),
              _JumpBackIn(taxonomy: t),
            ],
            const SizedBox(height: 20),
            SectionHeader(
              'Most viewed',
              onSeeAll: () => context.push('/home/list/popular'),
            ),
            const SizedBox(height: 8),
            _MostViewed(questions: popular.requireValue.items),
            const SizedBox(height: 20),
            const ShareCard(),
            const SizedBox(height: 20),
            SectionHeader(
              'Recently added',
              onSeeAll: () => context.push('/home/list/newest'),
            ),
            const SizedBox(height: 8),
            RowGroup(
              children: [
                // One exam per course, so a busy course doesn't fill it.
                for (final q in onePerCourse(newest.requireValue.items, 6))
                  QuestionRow(q),
              ],
            ),
            const SizedBox(height: 20),
            const _TopContributors(),
          ],
        ),
      );
    }
    return Scaffold(body: SafeArea(bottom: false, child: body));
  }
}

class _Masthead extends ConsumerWidget {
  const _Masthead();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider).value;
    return Row(
      children: [
        // The product's name; tapping it switches to another OurDIU product.
        const Expanded(child: SpaceTitle(Space.questions)),
        IconButton.filledTonal(
          tooltip: 'Account',
          onPressed: () => context.go('/account'),
          padding: profile == null ? null : EdgeInsets.zero,
          icon: profile == null
              ? const Icon(Icons.person_rounded)
              : PersonAvatar(name: profile.name, image: profile.image),
        ),
      ],
    );
  }
}

/// The departments, the reader's own first (selected), then the most papers
/// first, each with its paper count.
class _DepartmentChips extends ConsumerWidget {
  const _DepartmentChips({required this.departments});

  final List<DepartmentListItem> departments;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final mine = ref.watch(myDepartmentProvider);
    final sorted = [...departments]
      ..sort(
        (a, b) => a.id == mine
            ? -1
            : b.id == mine
            ? 1
            : b.publishedCount.compareTo(a.publishedCount),
      );
    return SizedBox(
      height: MediaQuery.textScalerOf(context).scale(44),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        itemCount: sorted.length.clamp(0, 10),
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final d = sorted[i];
          final own = d.id == mine;
          return ActionChip(
            tooltip: d.name,
            shape: StadiumBorder(
              side: own
                  ? BorderSide.none
                  : BorderSide(color: scheme.outlineVariant),
            ),
            backgroundColor: own ? scheme.secondaryContainer : null,
            padding: const EdgeInsets.fromLTRB(4, 4, 10, 4),
            avatar: null,
            label: Row(
              mainAxisSize: MainAxisSize.min,
              spacing: 8,
              children: [
                DecoratedBox(
                  decoration: ShapeDecoration(
                    color: scheme.primaryContainer,
                    shape: const StadiumBorder(),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 9,
                      vertical: 3,
                    ),
                    child: Text(
                      d.shortName,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: scheme.onPrimaryContainer,
                      ),
                    ),
                  ),
                ),
                Text(
                  thousands(d.publishedCount),
                  style: TextStyle(color: scheme.onSurfaceVariant),
                ),
              ],
            ),
            onPressed: () => context.push('/home/departments/${d.id}'),
          );
        },
      ),
    );
  }
}

/// A Material 3 hero carousel: the most viewed paper large, the next ones
/// narrower, in their exam type's colours.
class _MostViewed extends StatelessWidget {
  const _MostViewed({required this.questions});

  final List<Question> questions;

  @override
  Widget build(BuildContext context) {
    final items = questions.take(8).toList();
    return SizedBox(
      height: MediaQuery.textScalerOf(context).scale(200).clamp(200, 280),
      child: CarouselView.weighted(
        flexWeights: const [5, 3, 1],
        itemSnapping: true,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        onTap: (i) => openQuestion(context, items[i]),
        children: [for (final q in items) _CarouselCard(q)],
      ),
    );
  }
}

class _CarouselCard extends StatelessWidget {
  const _CarouselCard(this.question);

  final Question question;

  @override
  Widget build(BuildContext context) {
    final kind = examKind(question.examType.name);
    final (container, content) = examColors(context, kind);
    return ColoredBox(
      color: container,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final narrow = constraints.maxWidth < 160;
          return Stack(
            children: [
              Positioned(
                right: -30,
                bottom: -34,
                child: ExamShape(
                  kind,
                  color: content.withValues(alpha: 0.14),
                  size: 150,
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(18),
                child: DefaultTextStyle(
                  style: TextStyle(color: content, fontSize: 13),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${question.examType.name} · '
                        '${question.semester.name.replaceAll(' ', '\u00A0')}',
                        maxLines: narrow ? 2 : 1,
                        overflow: TextOverflow.fade,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const Spacer(),
                      Text(
                        noOrphans(question.course.name),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: fitLongestWord(
                          context,
                          noOrphans(question.course.name),
                          maxWidth: constraints.maxWidth - 36,
                          minScale: narrow ? 0.5 : 0.6,
                          style: narrow
                              ? expressive(
                                  18,
                                  width: 90,
                                  weight: 700,
                                  color: content,
                                )
                              : expressive(
                                  26,
                                  width: 115,
                                  weight: 760,
                                  color: content,
                                ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        spacing: 4,
                        children: [
                          Icon(
                            Icons.visibility_outlined,
                            size: 14,
                            color: content,
                          ),
                          Flexible(
                            child: Text(
                              narrow
                                  ? compactCount(question.viewCount)
                                  : '${compactCount(question.viewCount)} views · '
                                        '${question.department.shortName}',
                              maxLines: 1,
                              overflow: TextOverflow.fade,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Joins a short last word ("I", "II", "2") to the one before it with a
/// non-breaking space, so "Mathematics I" never leaves the "I" on its own line.
String noOrphans(String text) =>
    text.replaceFirstMapped(RegExp(r' (\S{1,3})$'), (m) => '\u00A0${m[1]}');

/// [style], made smaller (down to [minScale] of its size) until the longest word
/// of [text] fits on one line, so a card never breaks "Mathematics" into
/// "Mathemat / ics".
TextStyle fitLongestWord(
  BuildContext context,
  String text, {
  required double maxWidth,
  required TextStyle style,
  double minScale = 0.6,
}) {
  final longest = text
      .split(' ')
      .fold('', (a, b) => b.length > a.length ? b : a);
  final base = style.fontSize!;
  for (var size = base; size > base * minScale; size -= 1) {
    final candidate = style.copyWith(fontSize: size);
    final painter = TextPainter(
      text: TextSpan(text: longest, style: candidate),
      textDirection: TextDirection.ltr,
      textScaler: MediaQuery.textScalerOf(context),
      maxLines: 1,
    )..layout();
    final fits = painter.width <= maxWidth;
    painter.dispose();
    if (fits) return candidate;
  }
  return style.copyWith(fontSize: base * minScale);
}

class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton();

  @override
  Widget build(BuildContext context) => Skeleton(
    child: ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      children: const [
        Row(
          children: [
            Bone(width: 130, height: 20),
            Spacer(),
            Bone(width: 40, height: 40, radius: 20),
          ],
        ),
        SizedBox(height: 24),
        FractionallySizedBox(
          alignment: Alignment.centerLeft,
          widthFactor: 0.7,
          child: Bone(height: 84),
        ),
        SizedBox(height: 20),
        Bone(height: 56, radius: 28),
        SizedBox(height: 16),
        Row(
          spacing: 8,
          children: [
            Bone(width: 90, height: 40, radius: 20),
            Bone(width: 80, height: 40, radius: 20),
            Bone(width: 86, height: 40, radius: 20),
          ],
        ),
        SizedBox(height: 24),
        Row(
          spacing: 8,
          children: [
            Expanded(flex: 2, child: Bone(height: 200, radius: 28)),
            Expanded(child: Bone(height: 200, radius: 28)),
          ],
        ),
        SizedBox(height: 16),
        RowBone(),
        RowBone(),
        RowBone(),
      ],
    ),
  );
}

/// The students who share the most, as a row of faces; thanks, and a way in.
class _TopContributors extends ConsumerWidget {
  const _TopContributors();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(contributorsPageProvider(1)).value;
    if (page == null || page.items.isEmpty) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          'Top contributors',
          onSeeAll: () => context.push('/home/contributors'),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 136,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: page.items.take(10).length,
            separatorBuilder: (_, _) => const SizedBox(width: 4),
            itemBuilder: (context, i) {
              final c = page.items[i];
              return SizedBox(
                width: 84,
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => openContributor(context, c.username),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Column(
                      spacing: 6,
                      children: [
                        PersonAvatar(name: c.name, image: c.image, radius: 28),
                        Text(
                          c.name.split(' ').first,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(
                          plural(c.publishedCount, 'paper'),
                          style: TextStyle(
                            fontSize: 12,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// The first exam of each course, in order, up to [limit].
List<Question> onePerCourse(List<Question> questions, int limit) {
  final seen = <int>{};
  return [
    for (final q in questions)
      if (seen.add(q.course.id)) q,
  ].take(limit).toList();
}

/// Courses opened lately, a tap away: during exam week it's the same few.
class _JumpBackIn extends ConsumerWidget {
  const _JumpBackIn({required this.taxonomy});

  final Taxonomy taxonomy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final courses = [
      for (final id in ref.watch(recentCoursesProvider))
        ?taxonomy.courses.where((c) => c.id == id).firstOrNull,
    ];
    if (courses.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 8,
        children: [
          Text(
            'Jump back in',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: scheme.onSurfaceVariant,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(
            height: MediaQuery.textScalerOf(context).scale(40),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              itemCount: courses.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, i) => ActionChip(
                avatar: const Icon(Icons.history_rounded, size: 18),
                label: Text(courses[i].name),
                onPressed: () => context.push('/home/courses/${courses[i].id}'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
