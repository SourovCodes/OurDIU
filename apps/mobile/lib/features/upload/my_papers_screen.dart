import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/generated/export.dart';
import '../../data/format.dart';
import '../../theme/exam_shape.dart';
import '../../widgets/question_row.dart';
import '../../widgets/state_message.dart';
import 'paper_widgets.dart';
import 'papers.dart';
import 'review.dart';
import 'share_flow.dart';

/// Every paper you've shared, with a filter per status you actually have.
class MyPapersScreen extends ConsumerStatefulWidget {
  const MyPapersScreen({super.key});

  @override
  ConsumerState<MyPapersScreen> createState() => _MyPapersScreenState();
}

class _MyPapersScreenState extends ConsumerState<MyPapersScreen> {
  PaperStage? _filter;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(myPapersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Your papers')),
      body: switch (async) {
        AsyncData(:final value?) => _list(context, value),
        AsyncError(:final error) => StateMessage(
          icon: isOffline(error)
              ? Icons.cloud_off_rounded
              : Icons.error_outline_rounded,
          title: isOffline(error)
              ? "You're offline"
              : "Couldn't load your papers",
          body: 'Check your connection and try again.',
          actions: [
            FilledButton(
              onPressed: () => ref.invalidate(myPapersProvider),
              child: const Text('Try again'),
            ),
          ],
        ),
        _ => const Center(child: CircularProgressIndicator()),
      },
    );
  }

  Widget _list(BuildContext context, List<MySubmission> papers) {
    if (papers.isEmpty) {
      return StateMessage(
        icon: Icons.upload_file_rounded,
        shape: ExamKind.lab,
        title: 'Nothing shared yet',
        body: 'Papers you share appear here, with how the review is going.',
        actions: [
          FilledButton.icon(
            onPressed: () => startSharing(context, ref),
            icon: const Icon(Icons.add_rounded),
            label: const Text('Share a paper'),
          ),
        ],
      );
    }
    final counts = <PaperStage, int>{};
    for (final p in papers) {
      final stage = stageOf(stateOf(p));
      counts[stage] = (counts[stage] ?? 0) + 1;
    }
    final shown = [
      for (final p in papers)
        if (_filter == null || stageOf(stateOf(p)) == _filter) p,
    ];
    return RefreshIndicator(
      onRefresh: () => ref.refresh(myPapersProvider.future),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            child: Row(
              spacing: 8,
              children: [
                _FilterChip(
                  label: 'All',
                  count: papers.length,
                  selected: _filter == null,
                  onTap: () => setState(() => _filter = null),
                ),
                for (final stage in PaperStage.values)
                  if (counts[stage] case final count?)
                    _FilterChip(
                      label: stageLabel(stage),
                      count: count,
                      selected: _filter == stage,
                      onTap: () => setState(() => _filter = stage),
                    ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          RowGroup(children: [for (final p in shown) MyPaperRow(p)]),
          const SizedBox(height: 16),
          FilledButton.tonalIcon(
            onPressed: () => startSharing(context, ref),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
            ),
            icon: const Icon(Icons.add_rounded),
            label: const Text('Share another paper'),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => FilterChip(
    label: Text('$label  ${thousands(count)}'),
    selected: selected,
    showCheckmark: false,
    onSelected: (_) => onTap(),
  );
}
