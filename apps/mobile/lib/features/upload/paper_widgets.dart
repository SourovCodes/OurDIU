import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../api/generated/export.dart';
import '../../data/format.dart';
import '../../theme/exam_shape.dart';
import 'review.dart';

/// The container and content colours for a stage, from the exam palette:
/// indigo while checking, green when live, yellow while waiting, pink when not
/// published.
(Color, Color) stageColors(BuildContext context, PaperStage stage) =>
    examColors(context, switch (stage) {
      PaperStage.checking => ExamKind.finalExam,
      PaperStage.published => ExamKind.lab,
      PaperStage.checkDetails || PaperStage.waiting => ExamKind.quiz,
      PaperStage.rejected => ExamKind.midterm,
    });

String stageLabel(PaperStage stage) => switch (stage) {
  PaperStage.checking => 'Checking',
  PaperStage.published => 'Published',
  PaperStage.checkDetails => 'Check details',
  PaperStage.waiting => 'Waiting for review',
  PaperStage.rejected => 'Not published',
};

class StatusPill extends StatelessWidget {
  const StatusPill(this.stage, {super.key});

  final PaperStage stage;

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = stageColors(context, stage);
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: background,
        shape: const StadiumBorder(),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 3, 10, 3),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          spacing: 6,
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: foreground,
                shape: BoxShape.circle,
              ),
            ),
            Text(
              stageLabel(stage),
              style: TextStyle(
                color: foreground,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// e.g. "CSE · Final · Fall 25", from what a paper is filed under.
String paperDetails(SubmissionClassification c) => [
  c.department.shortName ?? c.department.name,
  c.examType.name,
  c.semester.name,
].map((p) => p.replaceAll(' ', ' ')).join(' · ');

/// One of your papers: its exam badge, course, status, and views once live.
class MyPaperRow extends StatelessWidget {
  const MyPaperRow(this.paper, {super.key});

  final MySubmission paper;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    final c = paper.classification;
    final stage = stageOf(stateOf(paper));
    return Material(
      color: theme.colorScheme.surfaceContainerLow,
      child: InkWell(
        onTap: () => context.push('/account/papers/${paper.id}'),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            spacing: 14,
            children: [
              ExamBadge(c.examType.name),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 2,
                  children: [
                    Text(
                      c.course.name,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w500,
                        height: 1.25,
                      ),
                    ),
                    Text(
                      paperDetails(c),
                      style: theme.textTheme.bodySmall?.copyWith(color: muted),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                spacing: 4,
                children: [
                  StatusPill(stage),
                  Text(
                    stage == PaperStage.published
                        ? plural(paper.viewCount, 'view')
                        : shortDate(paper.createdAt),
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
