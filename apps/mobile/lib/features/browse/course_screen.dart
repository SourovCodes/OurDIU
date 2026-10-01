import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/generated/export.dart';
import '../../data/format.dart';
import '../../data/questions.dart';
import '../../data/taxonomy.dart';
import '../../shell/app_shell.dart';
import '../../theme/exam_shape.dart';
import '../../theme/theme.dart';
import '../../widgets/question_row.dart';
import '../../widgets/skeleton.dart';
import '../../widgets/state_message.dart';

/// Every exam of a course, newest semester first, filterable by exam type.
class CourseScreen extends ConsumerStatefulWidget {
  const CourseScreen({super.key, required this.id});

  final int id;

  @override
  ConsumerState<CourseScreen> createState() => _CourseScreenState();
}

class _CourseScreenState extends ConsumerState<CourseScreen> {
  String? _examType;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final taxonomy = ref.watch(taxonomyProvider).value;
    final course = taxonomy?.courses
        .where((c) => c.id == widget.id)
        .firstOrNull;
    final dept = taxonomy?.departments
        .where((d) => d.id == course?.departmentId)
        .firstOrNull;
    final exams = ref.watch(
      questionPageProvider((courseQuestions(widget.id), 1)),
    );

    return Scaffold(
      appBar: AppBar(),
      body: switch (exams) {
        AsyncData(:final value) => _buildList(
          context,
          value.items,
          course,
          dept,
        ),
        AsyncError(:final error) => StateMessage(
          icon: isOffline(error)
              ? Icons.cloud_off_rounded
              : Icons.error_outline_rounded,
          shape: ExamKind.midterm,
          title: isOffline(error)
              ? "You're offline"
              : "Couldn't load this course",
          body: 'Check your connection and try again.',
          actions: [
            FilledButton(
              onPressed: () => ref.invalidate(
                questionPageProvider((courseQuestions(widget.id), 1)),
              ),
              child: const Text('Try again'),
            ),
          ],
        ),
        _ => Skeleton(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 8,
              children: [
                const Bone(width: 220, height: 36),
                const Bone(width: 160, height: 14),
                const SizedBox(height: 8),
                for (var i = 0; i < 5; i++) const RowBone(),
              ],
            ),
          ),
        ),
      },
      backgroundColor: scheme.surface,
    );
  }

  Widget _buildList(
    BuildContext context,
    List<Question> items,
    CourseListItem? course,
    DepartmentListItem? dept,
  ) {
    final scheme = Theme.of(context).colorScheme;
    final sorted = [...items]
      ..sort((a, b) {
        final bySemester = compareSemesters(a.semester.name, b.semester.name);
        return bySemester != 0
            ? bySemester
            : a.examType.name.compareTo(b.examType.name);
      });
    final counts = <String, int>{};
    for (final q in sorted) {
      counts[q.examType.name] = (counts[q.examType.name] ?? 0) + 1;
    }
    // Final, Midterm, Quiz, then lab exams, whatever order they came in.
    final types = Map.fromEntries(
      counts.entries.toList()..sort(
        (a, b) => examKind(a.key).index != examKind(b.key).index
            ? examKind(a.key).index - examKind(b.key).index
            : a.key.compareTo(b.key),
      ),
    );
    final shown = [
      for (final q in sorted)
        if (_examType == null || q.examType.name == _examType) q,
    ];
    final papers = items.fold(0, (n, q) => n + q.submissionCounts.published);
    final views = items.fold(0, (n, q) => n + q.viewCount);
    // Under their semester, newest first (the list is sorted that way).
    final semesters = <String, List<Question>>{};
    for (final q in shown) {
      (semesters[q.semester.name] ??= []).add(q);
    }
    final taxonomy = ref.watch(taxonomyProvider).value;
    final others = course == null || taxonomy == null
        ? const <CourseListItem>[]
        : sameCourses(taxonomy.courses, course);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      children: [
        Text(
          course?.name ?? '',
          style: expressive(
            34,
            width: 120,
            weight: 800,
            color: scheme.onSurface,
          ).copyWith(height: 1.02),
        ),
        const SizedBox(height: 6),
        Text(
          [
            if (dept != null) dept.name,
            if (items.isNotEmpty)
              '${plural(papers, 'paper')} from ${plural(items.length, 'exam')}',
            if (items.isNotEmpty) '${compactCount(views)} views',
          ].join(' · '),
          style: TextStyle(color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: 14),
        if (types.length > 1)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilterChip(
                label: Text('All  ${items.length}'),
                selected: _examType == null,
                showCheckmark: false,
                onSelected: (_) => setState(() => _examType = null),
              ),
              for (final MapEntry(key: type, value: n) in types.entries)
                FilterChip(
                  avatar: ExamShape(
                    examKind(type),
                    color: examColors(context, examKind(type)).$2,
                  ),
                  label: Text('$type  $n'),
                  selected: _examType == type,
                  showCheckmark: false,
                  onSelected: (on) =>
                      setState(() => _examType = on ? type : null),
                ),
            ],
          ),
        const SizedBox(height: 14),
        if (shown.isEmpty)
          const StateMessage(
            icon: Icons.description_outlined,
            title: 'No papers yet',
            body: 'Nobody has shared a paper for this course yet.',
          )
        else
          for (final MapEntry(key: semester, value: rows)
              in semesters.entries) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 6, 4, 8),
              child: Text(
                semester,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: scheme.onSurfaceVariant,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                ),
              ),
            ),
            RowGroup(
              children: [
                for (final q in rows) QuestionRow(q, withinSemester: true),
              ],
            ),
            const SizedBox(height: 14),
          ],
        if (others.isNotEmpty) ...[
          const SizedBox(height: 8),
          Card.filled(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 8, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Same course, other names',
                    style: expressive(20, width: 115, weight: 760),
                  ),
                  const SizedBox(height: 4),
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Text(
                      'Papers are filed under the name on the question sheet, so check these too.',
                      style: TextStyle(color: scheme.onSurfaceVariant),
                    ),
                  ),
                  for (final other in others)
                    ListTile(
                      contentPadding: const EdgeInsets.only(right: 8),
                      title: Text(other.name),
                      trailing: Text(
                        taxonomy!.departments
                                .where((d) => d.id == other.departmentId)
                                .firstOrNull
                                ?.shortName ??
                            '',
                        style: TextStyle(
                          color: scheme.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      onTap: () => context.push(
                        '${tabRoot(context)}/courses/${other.id}',
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}
