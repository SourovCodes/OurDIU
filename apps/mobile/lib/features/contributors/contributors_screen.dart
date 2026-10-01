import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/generated/export.dart';
import '../../data/contributors.dart';
import '../../data/format.dart';
import '../../theme/exam_shape.dart';
import '../../theme/theme.dart';
import '../../widgets/avatar.dart';
import '../../widgets/skeleton.dart';
import '../../widgets/state_message.dart';

/// Opens a contributor's profile from wherever the list is shown.
void openContributor(BuildContext context, String username) =>
    context.push('/home/contributors/${Uri.encodeComponent(username)}');

/// The students who share papers, most published first: the top three as tiles
/// in the exam colours, everyone else as rows. As on the website.
class ContributorsScreen extends ConsumerStatefulWidget {
  const ContributorsScreen({super.key});

  @override
  ConsumerState<ContributorsScreen> createState() => _ContributorsScreenState();
}

class _ContributorsScreenState extends ConsumerState<ContributorsScreen> {
  var _pages = 1;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final first = ref.watch(contributorsPageProvider(1));
    return Scaffold(
      appBar: AppBar(),
      body: switch (first) {
        AsyncData(:final value) => RefreshIndicator(
          onRefresh: () => ref.refresh(contributorsPageProvider(1).future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            children: [
              Text(
                'Contributors',
                style: expressive(40, color: scheme.onSurface),
              ),
              const SizedBox(height: 6),
              Text(
                'The ${thousands(value.total)} students who share question '
                'papers with everyone. Most papers first.',
                style: TextStyle(color: scheme.onSurfaceVariant),
              ),
              const SizedBox(height: 20),
              for (final (i, c) in value.items.take(3).indexed) ...[
                _PodiumTile(contributor: c, rank: i + 1),
                const SizedBox(height: 10),
              ],
              const SizedBox(height: 6),
              _Rows(contributors: value.items.skip(3).toList(), firstRank: 4),
              for (var page = 2; page <= _pages; page++) _MorePage(page: page),
              if (_pages * contributorsPageSize < value.total)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Center(
                    child: FilledButton.tonal(
                      onPressed: () => setState(() => _pages++),
                      child: const Text('Show more'),
                    ),
                  ),
                ),
            ],
          ),
        ),
        AsyncError(:final error) => StateMessage(
          icon: isOffline(error)
              ? Icons.cloud_off_rounded
              : Icons.error_outline_rounded,
          shape: ExamKind.midterm,
          title: isOffline(error)
              ? "You're offline"
              : "Couldn't load contributors",
          body: 'Check your connection and try again.',
          actions: [
            FilledButton(
              onPressed: () => ref.invalidate(contributorsPageProvider(1)),
              child: const Text('Try again'),
            ),
          ],
        ),
        _ => Skeleton(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 10,
              children: [
                const Bone(width: 240, height: 40),
                const Bone(width: 200, height: 14),
                const SizedBox(height: 8),
                for (var i = 0; i < 3; i++) const Bone(height: 120),
              ],
            ),
          ),
        ),
      },
    );
  }
}

class _MorePage extends ConsumerWidget {
  const _MorePage({required this.page});

  final int page;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return switch (ref.watch(contributorsPageProvider(page))) {
      AsyncData(:final value) => Padding(
        padding: const EdgeInsets.only(top: 2),
        child: _Rows(
          contributors: value.items,
          firstRank: (page - 1) * contributorsPageSize + 1,
        ),
      ),
      AsyncError() => const SizedBox.shrink(),
      _ => const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      ),
    };
  }
}

/// One of the top three, in the Final, Midterm and Quiz colours.
class _PodiumTile extends StatelessWidget {
  const _PodiumTile({required this.contributor, required this.rank});

  final Contributor contributor;
  final int rank;

  @override
  Widget build(BuildContext context) {
    final kind = [
      ExamKind.finalExam,
      ExamKind.midterm,
      ExamKind.quiz,
    ][rank - 1];
    final (container, content) = examColors(context, kind);
    return Material(
      color: container,
      borderRadius: BorderRadius.circular(28),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => openContributor(context, contributor.username),
        child: Stack(
          children: [
            Positioned(
              right: -24,
              bottom: -28,
              child: ExamShape(
                kind,
                color: content.withValues(alpha: 0.1),
                size: 120,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                spacing: 16,
                children: [
                  PersonAvatar(
                    name: contributor.name,
                    image: contributor.image,
                    radius: 30,
                    background: content.withValues(alpha: 0.15),
                    foreground: content,
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      spacing: 2,
                      children: [
                        Text(
                          contributor.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: expressive(
                            21,
                            width: 115,
                            weight: 780,
                            color: content,
                          ),
                        ),
                        Text(
                          _summary(contributor),
                          style: TextStyle(color: content, height: 1.3),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '#$rank',
                    semanticsLabel: 'Ranked $rank',
                    style: expressive(
                      30,
                      color: content.withValues(alpha: 0.8),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _summary(Contributor c) => [
  plural(c.publishedCount, 'paper'),
  '${compactCount(c.viewCount)} views',
  if (c.departments.isNotEmpty)
    c.departments.take(3).map((d) => d.shortName).join(', '),
].join(' · ');

class _Rows extends StatelessWidget {
  const _Rows({required this.contributors, required this.firstRank});

  final List<Contributor> contributors;
  final int firstRank;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    return Column(
      spacing: 2,
      children: [
        for (final (i, c) in contributors.indexed)
          Material(
            color: theme.colorScheme.surfaceContainerLow,
            borderRadius: BorderRadius.vertical(
              top: Radius.circular(i == 0 ? 20 : 4),
              bottom: Radius.circular(i == contributors.length - 1 ? 20 : 4),
            ),
            clipBehavior: Clip.antiAlias,
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 4,
              ),
              leading: PersonAvatar(name: c.name, image: c.image),
              title: Text(c.name, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text(_summary(c)),
              trailing: Text(
                '#${firstRank + i}',
                style: TextStyle(color: muted, fontWeight: FontWeight.w600),
              ),
              onTap: () => openContributor(context, c.username),
            ),
          ),
      ],
    );
  }
}
