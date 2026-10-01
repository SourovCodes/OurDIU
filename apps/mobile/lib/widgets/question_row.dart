import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../api/generated/export.dart';
import '../data/format.dart';
import '../theme/exam_shape.dart';

/// e.g. "CSE · Final · Fall 25".
String questionDetails(Question q) => [
  q.department.shortName,
  q.examType.name,
  q.semester.name,
].map(_keepTogether).join(' · ');

/// "Summer 26" never wraps between its words; the line breaks at the dots.
String _keepTogether(String part) => part.replaceAll(' ', '\u00A0');

void openQuestion(BuildContext context, Question q) =>
    context.push('/questions/${q.id}', extra: q);

/// Rows that belong together, drawn as one rounded block with hairline gaps
/// (Material 3 Expressive's segmented list).
class RowGroup extends StatelessWidget {
  const RowGroup({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    const outer = Radius.circular(20);
    const inner = Radius.circular(4);
    return Column(
      spacing: 2,
      children: [
        for (final (i, child) in children.indexed)
          ClipRRect(
            borderRadius: BorderRadius.vertical(
              top: i == 0 ? outer : inner,
              bottom: i == children.length - 1 ? outer : inner,
            ),
            child: child,
          ),
      ],
    );
  }
}

/// A question in a list: its exam badge, course (or semester, within a course)
/// and how many papers and views it has.
class QuestionRow extends StatelessWidget {
  const QuestionRow(
    this.question, {
    super.key,
    this.withinCourse = false,
    this.withinSemester = false,
  });

  final Question question;

  /// On a course's page the course name is known, so the row leads with the
  /// semester.
  final bool withinCourse;

  /// Under a semester's heading on a course's page: just the exam type.
  final bool withinSemester;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    final q = question;
    return Material(
      color: theme.colorScheme.surfaceContainerLow,
      child: InkWell(
        onTap: () => openQuestion(context, q),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            spacing: 14,
            children: [
              ExamBadge(q.examType.name),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 2,
                  children: [
                    Text(
                      withinSemester
                          ? q.examType.name
                          : withinCourse
                          ? q.semester.name
                          : q.course.name,
                      style: theme.textTheme.titleMedium?.copyWith(
                        height: 1.25,
                      ),
                    ),
                    if (!withinSemester)
                      Text(
                        withinCourse ? q.examType.name : questionDetails(q),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: muted,
                        ),
                      ),
                  ],
                ),
              ),
              DefaultTextStyle.merge(
                style: theme.textTheme.bodySmall?.copyWith(
                  color: muted,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  spacing: 2,
                  children: [
                    Text(plural(q.submissionCounts.published, 'paper')),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      spacing: 3,
                      children: [
                        Icon(Icons.visibility_outlined, size: 14, color: muted),
                        Text(
                          compactCount(q.viewCount),
                          semanticsLabel: '${thousands(q.viewCount)} views',
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
    );
  }
}
