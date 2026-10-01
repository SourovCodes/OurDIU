import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/generated/export.dart';
import '../../data/contributors.dart';
import '../../data/format.dart';
import '../../theme/exam_shape.dart';
import '../../theme/theme.dart';
import '../../widgets/avatar.dart';
import '../../widgets/question_row.dart';
import '../../widgets/skeleton.dart';
import '../../widgets/state_message.dart';

const _months = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', //
  'August', 'September', 'October', 'November', 'December',
];

/// A contributor: who they are, what they shared, and how much it's read. As the
/// website's profile.
class ContributorScreen extends ConsumerWidget {
  const ContributorScreen({super.key, required this.username});

  final String username;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(),
      body: switch (ref.watch(contributorProvider(username))) {
        AsyncData(:final value) => _Profile(contributor: value),
        AsyncError(:final error) => StateMessage(
          icon: isOffline(error)
              ? Icons.cloud_off_rounded
              : Icons.person_off_outlined,
          shape: ExamKind.midterm,
          title: isOffline(error) ? "You're offline" : 'Contributor not found',
          body: isOffline(error)
              ? 'Check your connection and try again.'
              : 'The link may be old, or they changed their username.',
          actions: [
            FilledButton(
              onPressed: () => ref.invalidate(contributorProvider(username)),
              child: const Text('Try again'),
            ),
          ],
        ),
        _ => const Skeleton(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              spacing: 10,
              children: [
                Bone(height: 180),
                SizedBox(height: 8),
                RowBone(),
                RowBone(),
                RowBone(),
              ],
            ),
          ),
        ),
      },
    );
  }
}

class _Profile extends StatelessWidget {
  const _Profile({required this.contributor});

  final ContributorDetail contributor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final c = contributor;
    final joined = '${_months[c.joinedAt.month - 1]} ${c.joinedAt.year}';
    final papers = c.submissions.items;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: scheme.primaryContainer,
            borderRadius: BorderRadius.circular(28),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 16,
            children: [
              Row(
                spacing: 16,
                children: [
                  PersonAvatar(
                    name: c.name,
                    image: c.image,
                    radius: 36,
                    background: scheme.primary,
                    foreground: scheme.onPrimary,
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      spacing: 4,
                      children: [
                        Text(
                          c.name,
                          style: expressive(
                            26,
                            width: 120,
                            weight: 800,
                            color: scheme.onPrimaryContainer,
                          ),
                        ),
                        Text(
                          'Contributor since $joined',
                          style: TextStyle(color: scheme.onPrimaryContainer),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              Row(
                spacing: 8,
                children: [
                  _Stat(
                    value: compactCount(c.publishedCount),
                    label: c.publishedCount == 1 ? 'paper' : 'papers',
                  ),
                  _Stat(
                    value: compactCount(c.viewCount),
                    label: c.viewCount == 1 ? 'view' : 'views',
                  ),
                  _Stat(
                    value: '${c.departments.length}',
                    label: c.departments.length == 1
                        ? 'department'
                        : 'departments',
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Text('Papers', style: expressive(24, width: 120, weight: 780)),
        const SizedBox(height: 10),
        if (papers.isEmpty)
          Text(
            'Nothing published yet.',
            style: TextStyle(color: scheme.onSurfaceVariant),
          )
        else
          RowGroup(children: [for (final p in papers) _PaperRow(paper: p)]),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: scheme.surface.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value, style: expressive(22, width: 115, weight: 800)),
            Text(
              label,
              style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}

class _PaperRow extends StatelessWidget {
  const _PaperRow({required this.paper});

  final ContributorSubmission paper;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    final k = paper.classification;
    final details = [
      ?k.department.shortName,
      k.examType.name,
      k.semester.name,
      if (paper.section case final s?) 'Section $s',
      if (paper.batch case final b?) 'Batch $b',
    ].join(' · ');
    return Material(
      color: theme.colorScheme.surfaceContainerLow,
      child: InkWell(
        onTap: paper.questionId == null
            ? null
            : () => context.push(
                '/questions/${paper.questionId}?submission=${paper.id}',
              ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            spacing: 14,
            children: [
              ExamBadge(k.examType.name),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 2,
                  children: [
                    Text(k.course.name, style: theme.textTheme.titleMedium),
                    Text(
                      details,
                      style: theme.textTheme.bodyMedium?.copyWith(color: muted),
                    ),
                  ],
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                spacing: 3,
                children: [
                  Icon(Icons.visibility_outlined, size: 14, color: muted),
                  Text(
                    compactCount(paper.viewCount),
                    style: theme.textTheme.bodySmall?.copyWith(color: muted),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
