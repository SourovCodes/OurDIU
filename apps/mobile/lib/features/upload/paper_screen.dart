import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../api/api.dart';
import '../../api/generated/export.dart';
import '../../auth/session.dart';
import '../../data/format.dart';
import '../../theme/exam_shape.dart';
import '../../theme/theme.dart';
import '../../widgets/state_message.dart';
import 'paper_widgets.dart';
import 'papers.dart';
import 'review.dart';
import 'share_flow.dart';

/// One of your papers: where it stands, what the AI read, and what you can do.
/// While the AI check runs, the page refreshes itself until it's done.
class PaperScreen extends ConsumerStatefulWidget {
  const PaperScreen({super.key, required this.id});

  final int id;

  @override
  ConsumerState<PaperScreen> createState() => _PaperScreenState();
}

class _PaperScreenState extends ConsumerState<PaperScreen> {
  static const _pollEvery = Duration(seconds: 3);
  static const _pollFor = Duration(minutes: 3);

  Timer? _poll;
  final _started = DateTime.now();
  var _busy = false;

  @override
  void initState() {
    super.initState();
    ref.listenManual(myPaperProvider(widget.id), (previous, next) {
      final was = previous?.value;
      final now = next.value;
      if (now == null) return;
      final checking = stageOf(detailStateOf(now)) == PaperStage.checking;
      if (checking && DateTime.now().difference(_started) < _pollFor) {
        _poll ??= Timer.periodic(_pollEvery, (_) {
          ref.invalidate(myPaperProvider(widget.id));
        });
      } else {
        _poll?.cancel();
        _poll = null;
      }
      // The check finished: the list and your counts changed too.
      if (was != null && was.status != now.status ||
          was?.analysis?.status != now.analysis?.status) {
        ref
          ..invalidate(myPapersProvider)
          ..invalidate(profileProvider);
      }
    }, fireImmediately: true);
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  void _snack(String text) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));

  Future<void> _useAiDetails(MySubmissionDetail paper) async {
    setState(() => _busy = true);
    try {
      final updated = await ref
          .read(qbApiProvider)
          .account
          .putApiV1MeSubmissionsIdClassification(
            id: paper.id,
            body: aiDetails(
              paper.classification,
              paper.analysisDetail!.values!,
              section: paper.section,
              batch: paper.batch,
            ),
          );
      _updated(updated);
    } catch (e) {
      _snack(apiErrorMessage(e) ?? "Couldn't update the details. Try again.");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _editDetails(MySubmissionDetail paper) async {
    final updated = await context.push<MySubmissionDetail>(
      '/account/papers/${paper.id}/edit',
      extra: paper,
    );
    if (updated != null && mounted) _updated(updated);
  }

  void _updated(MySubmissionDetail updated) {
    ref
      ..invalidate(myPaperProvider(widget.id))
      ..invalidate(myPapersProvider)
      ..invalidate(profileProvider);
    if (!mounted) return;
    _snack(
      updated.status == SubmissionStatus.published
          ? "Details updated. They match the AI's reading, so it's published."
          : 'Details updated. An admin will take a look.',
    );
  }

  Future<void> _withdraw(MySubmissionDetail paper) async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      showDragHandle: true,
      builder: (context) => const _ConfirmWithdraw(),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(qbApiProvider)
          .account
          .deleteApiV1MeSubmissionsId(id: paper.id);
      ref.invalidate(myPapersProvider);
      if (!mounted) return;
      _snack('Paper withdrawn');
      context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _snack(
        e is DioException && e.response?.statusCode == 409
            ? 'Published papers stay up. Contact us to remove one.'
            : "Couldn't withdraw the paper. Try again.",
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(myPaperProvider(widget.id));
    // Refreshes keep showing the paper instead of a spinner.
    if (async.value case final paper?) return _page(context, paper);
    return Scaffold(
      appBar: AppBar(),
      body: async.hasError
          ? StateMessage(
              icon: isOffline(async.error!)
                  ? Icons.cloud_off_rounded
                  : Icons.error_outline_rounded,
              title: isOffline(async.error!)
                  ? "You're offline"
                  : switch (async.error) {
                      DioException(response: Response(statusCode: 404)) =>
                        'This paper is gone',
                      _ => "Couldn't load your paper",
                    },
              body: 'Check your connection and try again.',
              actions: [
                FilledButton(
                  onPressed: () => ref.invalidate(myPaperProvider(widget.id)),
                  child: const Text('Try again'),
                ),
              ],
            )
          : const Center(child: CircularProgressIndicator()),
    );
  }

  Widget _page(BuildContext context, MySubmissionDetail paper) {
    final theme = Theme.of(context);
    final c = paper.classification;
    final state = detailStateOf(paper);
    final stage = stageOf(state);
    final analysis = paper.analysisDetail;
    final values = analysis?.status == AnalysisStatus.completed
        ? analysis?.values
        : null;
    final rows = values == null
        ? const <ComparisonRow>[]
        : compareWithAnalysis(
            c,
            values,
            section: paper.section,
            batch: paper.batch,
          );
    final pending = paper.status == SubmissionStatus.pendingReview;
    final canUseAi =
        stage == PaperStage.checkDetails && rows.any((r) => r.differs);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              c.course.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 17),
            ),
            Text(
              paperDetails(c),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(myPaperProvider(widget.id).future),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
          children: [
            _StatusHero(
              paper: paper,
              stage: stage,
              description: stageDescription(
                state,
                autoPublished: paper.autoPublished,
                rejectionReason: paper.rejectionReason,
              ),
              onUploadAnother: () => startSharing(context, ref),
            ),
            if (stage == PaperStage.published) ...[
              const SizedBox(height: 12),
              Row(
                spacing: 8,
                children: [
                  _StatTile(
                    value: thousands(paper.viewCount),
                    label: paper.viewCount == 1 ? 'view' : 'views',
                  ),
                  _StatTile(
                    value: thousands(paper.likeCount),
                    label: paper.likeCount == 1 ? 'like' : 'likes',
                  ),
                ],
              ),
            ],
            const SizedBox(height: 20),
            _Timeline(paper: paper, stage: stage),
            if (rows.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                "Your details and the AI's reading",
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 10),
              _Comparison(rows: rows),
            ],
            if (analysis?.note case final note? when note.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                'The AI noted: $note',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            if (pending && stage != PaperStage.checking) ...[
              const SizedBox(height: 20),
              if (canUseAi) ...[
                FilledButton.icon(
                  onPressed: _busy ? null : () => _useAiDetails(paper),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                  ),
                  icon: const Icon(Icons.auto_fix_high_rounded),
                  label: const Text("Use the AI's details"),
                ),
                const SizedBox(height: 8),
              ],
              FilledButton.tonalIcon(
                onPressed: _busy ? null : () => _editDetails(paper),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Edit my details'),
              ),
              if (canUseAi)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Think the AI is wrong? Leave it as it is; an admin will look.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
            ],
            if (paper.status != SubmissionStatus.published) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _busy ? null : () => _withdraw(paper),
                style: OutlinedButton.styleFrom(
                  foregroundColor: theme.colorScheme.error,
                  side: BorderSide(
                    color: theme.colorScheme.error.withValues(alpha: 0.45),
                  ),
                  minimumSize: const Size.fromHeight(48),
                ),
                icon: const Icon(Icons.delete_outline_rounded),
                label: const Text('Withdraw'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatusHero extends StatelessWidget {
  const _StatusHero({
    required this.paper,
    required this.stage,
    required this.description,
    required this.onUploadAnother,
  });

  final MySubmissionDetail paper;
  final PaperStage stage;
  final String description;
  final VoidCallback onUploadAnother;

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = stageColors(context, stage);
    final kind = examKind(paper.classification.examType.name);
    final questionId = paper.questionId;
    final title = switch (stage) {
      PaperStage.checking => 'Checking your paper',
      PaperStage.published => 'It’s live',
      PaperStage.checkDetails => 'Check your details',
      PaperStage.waiting => 'Waiting for review',
      PaperStage.rejected => 'Not published',
    };
    return Semantics(
      liveRegion: true,
      child: Material(
        color: background,
        borderRadius: BorderRadius.circular(28),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            Positioned(
              right: -26,
              top: -22,
              child: ExamShape(
                kind,
                color: foreground.withValues(alpha: 0.14),
                size: 130,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 8,
                children: [
                  switch (stage) {
                    PaperStage.checking => _Working(color: foreground),
                    _ => Icon(
                      switch (stage) {
                        PaperStage.published => Icons.check_circle_rounded,
                        PaperStage.rejected => Icons.block_rounded,
                        _ => Icons.schedule_rounded,
                      },
                      color: foreground,
                      size: 40,
                    ),
                  },
                  Text(
                    title,
                    style: expressive(
                      30,
                      width: 118,
                      weight: 800,
                      color: foreground,
                    ).copyWith(height: 1.02),
                  ),
                  Text(
                    description,
                    style: TextStyle(color: foreground, height: 1.4),
                  ),
                  if (stage == PaperStage.published && questionId != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          FilledButton.icon(
                            onPressed: () =>
                                context.push('/questions/$questionId'),
                            icon: const Icon(Icons.description_outlined),
                            label: const Text('Open it'),
                          ),
                          FilledButton.tonalIcon(
                            onPressed: () => SharePlus.instance.share(
                              ShareParams(
                                uri: Uri.parse(
                                  '$apiBaseUrl/questions/$questionId',
                                ),
                              ),
                            ),
                            icon: const Icon(Icons.share_outlined),
                            label: const Text('Share link'),
                          ),
                        ],
                      ),
                    ),
                  if (paper.analysis?.flag == AnalysisFlag.multiplePapers &&
                      paper.status == SubmissionStatus.pendingReview)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: FilledButton.icon(
                        onPressed: onUploadAnother,
                        icon: const Icon(Icons.add_rounded),
                        label: const Text('Upload a paper'),
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

/// The exam shape turning and breathing while the AI reads the paper.
class _Working extends StatefulWidget {
  const _Working({required this.color});

  final Color color;

  @override
  State<_Working> createState() => _WorkingState();
}

class _WorkingState extends State<_Working>
    with SingleTickerProviderStateMixin {
  late final _spin = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  )..repeat();

  @override
  void dispose() {
    _spin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // No endless motion for people who turned animations off.
    if (MediaQuery.disableAnimationsOf(context)) {
      return ExamShape(ExamKind.finalExam, color: widget.color, size: 48);
    }
    return AnimatedBuilder(
      animation: _spin,
      builder: (context, child) {
        final t = _spin.value;
        final breathe = 0.9 + 0.1 * math.sin(t * 2 * math.pi * 3);
        return Transform.rotate(
          angle: t * 2 * math.pi,
          child: Transform.scale(scale: breathe, child: child),
        );
      },
      child: ExamShape(ExamKind.finalExam, color: widget.color, size: 48),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Expanded(
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: scheme.surfaceContainer,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 4,
            children: [
              Text(
                value,
                style: expressive(
                  26,
                  width: 120,
                  weight: 780,
                  color: scheme.onSurface,
                ).copyWith(height: 1),
              ),
              Text(
                label,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Uploaded → AI check → decision.
class _Timeline extends StatelessWidget {
  const _Timeline({required this.paper, required this.stage});

  final MySubmissionDetail paper;
  final PaperStage stage;

  @override
  Widget build(BuildContext context) {
    final analysis = paper.analysisDetail;
    final aiStep = switch (analysis?.status) {
      null => 'Not checked',
      AnalysisStatus.queued ||
      AnalysisStatus.processing => 'Reading the paper…',
      AnalysisStatus.failed ||
      AnalysisStatus.$unknown => "Couldn't read it; an admin will check",
      AnalysisStatus.completed => switch (analysis!.flag) {
        AnalysisFlag.multiplePapers =>
          analysis.paperCount != null && analysis.paperCount! > 1
              ? 'Found ${analysis.paperCount} question papers in one file'
              : 'Found more than one question paper',
        AnalysisFlag.notAPaper => "Doesn't look like a question paper",
        _ when paper.analysis?.matches == true =>
          'One question paper, details match',
        _ => 'Read different details',
      },
    };
    final steps = [
      (Icons.upload_rounded, 'Uploaded', shortDate(paper.createdAt), true),
      (
        Icons.smart_toy_outlined,
        'AI check',
        aiStep,
        stage != PaperStage.checking && analysis != null,
      ),
      (
        Icons.verified_outlined,
        'Decision',
        switch (stage) {
          PaperStage.published =>
            paper.autoPublished
                ? 'Published automatically'
                : 'Published by an admin',
          PaperStage.rejected => 'Not published by an admin',
          PaperStage.checking => 'After the check',
          _ => 'Waiting for an admin',
        },
        stage == PaperStage.published || stage == PaperStage.rejected,
      ),
    ];
    return Column(
      children: [
        for (final (i, (icon, title, subtitle, done)) in steps.indexed)
          _Step(
            icon: icon,
            title: title,
            subtitle: subtitle,
            done: done,
            last: i == steps.length - 1,
          ),
      ],
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.done,
    required this.last,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool done;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          Column(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: done ? scheme.primary : scheme.surfaceContainerHighest,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  done ? Icons.check_rounded : icon,
                  size: 16,
                  color: done ? scheme.onPrimary : scheme.onSurfaceVariant,
                ),
              ),
              if (!last)
                Expanded(
                  child: Container(width: 2, color: scheme.outlineVariant),
                ),
            ],
          ),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: last ? 0 : 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Comparison extends StatelessWidget {
  const _Comparison({required this.rows});

  final List<ComparisonRow> rows;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final (_, differs) = examColors(context, ExamKind.midterm);
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Column(
        spacing: 2,
        children: [
          for (final row in rows)
            ColoredBox(
              color: scheme.surfaceContainerLow,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 92,
                      child: Text(
                        row.label,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        spacing: 2,
                        children: [
                          Text(row.mine ?? '—'),
                          Row(
                            spacing: 4,
                            children: [
                              Icon(
                                row.ai == null
                                    ? Icons.help_outline_rounded
                                    : row.differs
                                    ? Icons.smart_toy_outlined
                                    : Icons.check_rounded,
                                size: 16,
                                color: row.differs
                                    ? differs
                                    : scheme.onSurfaceVariant,
                              ),
                              Flexible(
                                child: Text(
                                  row.ai == null
                                      ? "AI couldn't read it"
                                      : row.differs
                                      ? 'AI read ${row.ai}'
                                      : 'AI read the same',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: row.differs
                                        ? differs
                                        : scheme.onSurfaceVariant,
                                    fontWeight: row.differs
                                        ? FontWeight.w600
                                        : null,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ConfirmWithdraw extends StatelessWidget {
  const _ConfirmWithdraw();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 8,
          children: [
            Text(
              'Withdraw this paper?',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              "It's deleted and won't be reviewed. You can upload it again later.",
              style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              spacing: 8,
              children: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Withdraw'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
