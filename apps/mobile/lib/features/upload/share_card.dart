import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/generated/export.dart';
import '../../theme/exam_shape.dart';
import '../../theme/theme.dart';
import '../../widgets/question_row.dart';
import 'paper_widgets.dart';
import 'papers.dart';
import 'share_flow.dart';

/// "Just sat an exam?" on Home: asks for the paper while it's fresh.
class ShareCard extends ConsumerWidget {
  const ShareCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainer,
      borderRadius: BorderRadius.circular(28),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Positioned(
            right: -8,
            top: 12,
            child: ExcludeSemantics(
              child: SizedBox(
                width: 82,
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final kind in ExamKind.values)
                      ExamShape(
                        kind,
                        color: examColors(context, kind).$1,
                        size: 38,
                      ),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 96, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 8,
              children: [
                Text(
                  'Just sat an exam?',
                  style: expressive(
                    20,
                    width: 112,
                    weight: 720,
                    color: scheme.onSurface,
                  ),
                ),
                Text(
                  'Share the question paper. It takes a minute and helps the '
                  'next batch.',
                  style: TextStyle(color: scheme.onSurfaceVariant, height: 1.4),
                ),
                const SizedBox(height: 2),
                FilledButton.tonalIcon(
                  onPressed: () => startSharing(context, ref),
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Share a paper'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// On the signed-in Account tab: your latest papers and "Share a paper".
class YourPapersSection extends ConsumerWidget {
  const YourPapersSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final papers = ref.watch(myPapersProvider).value ?? const <MySubmission>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Your papers',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (papers.isNotEmpty)
              TextButton(
                onPressed: () => context.push('/account/papers'),
                child: Text('See all ${papers.length}'),
              ),
          ],
        ),
        if (papers.isEmpty)
          Text(
            'Papers you share show up here, with how the review is going.',
            style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
          )
        else
          RowGroup(children: [for (final p in papers.take(3)) MyPaperRow(p)]),
        FilledButton.icon(
          onPressed: () => startSharing(context, ref),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          icon: const Icon(Icons.add_rounded),
          label: const Text('Share a paper'),
        ),
      ],
    );
  }
}
