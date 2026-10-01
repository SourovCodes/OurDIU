import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/generated/export.dart';
import '../../data/format.dart';
import '../../data/taxonomy.dart';
import '../../shell/app_shell.dart';
import '../../theme/exam_shape.dart';
import '../../theme/theme.dart';
import '../../widgets/state_message.dart';

/// A department's courses, A to Z under letter headings, with a filter: some
/// departments have 60+ courses.
class DepartmentScreen extends ConsumerStatefulWidget {
  const DepartmentScreen({super.key, required this.id});

  final int id;

  @override
  ConsumerState<DepartmentScreen> createState() => _DepartmentScreenState();
}

class _DepartmentScreenState extends ConsumerState<DepartmentScreen> {
  var _filter = '';

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final taxonomy = ref.watch(taxonomyProvider).value;
    final dept = taxonomy?.departments
        .where((d) => d.id == widget.id)
        .firstOrNull;
    if (taxonomy == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (dept == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const StateMessage(
          icon: Icons.domain_disabled_rounded,
          shape: ExamKind.quiz,
          title: 'Department not found',
          body: 'It may have been renamed or merged.',
        ),
      );
    }
    final courses =
        taxonomy.courses.where((c) => c.departmentId == dept.id).toList()..sort(
          (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
        );
    final f = _filter.trim().toLowerCase();
    final shown = courses
        .where((c) => c.name.toLowerCase().contains(f))
        .toList();

    final children = <Widget>[];
    String? letter;
    for (final c in shown) {
      final l = c.name[0].toUpperCase();
      if (l != letter) {
        letter = l;
        children.add(
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 18, 4, 6),
            // Large, as the website's letter headings.
            child: Text(
              l,
              style: expressive(
                28,
                width: 125,
                weight: 820,
                color: scheme.primary,
              ),
            ),
          ),
        );
      }
      children.add(_CourseTile(course: c));
    }

    return Scaffold(
      appBar: AppBar(title: Text(dept.shortName)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          Text(
            dept.name,
            style: expressive(
              30,
              width: 112,
              weight: 760,
              color: scheme.onSurface,
            ).copyWith(height: 1.05),
          ),
          const SizedBox(height: 6),
          Text(
            '${plural(dept.publishedCount, 'paper')} · ${plural(courses.length, 'course')}',
            style: TextStyle(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: 16),
          if (courses.length > 8)
            TextField(
              onChanged: (v) => setState(() => _filter = v),
              decoration: InputDecoration(
                hintText: 'Filter ${courses.length} courses',
                prefixIcon: const Icon(Icons.filter_list_rounded),
                filled: true,
                fillColor: scheme.surfaceContainerHigh,
                border: const OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(28)),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ...children,
          if (shown.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 24),
              child: Text(
                'No course matches “$_filter”.',
                style: TextStyle(color: scheme.onSurfaceVariant),
              ),
            ),
        ],
      ),
    );
  }
}

class _CourseTile extends StatelessWidget {
  const _CourseTile({required this.course});

  final Course course;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Material(
        color: scheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        clipBehavior: Clip.antiAlias,
        child: ListTile(
          title: Text(course.name),
          trailing: Icon(
            Icons.chevron_right_rounded,
            color: scheme.onSurfaceVariant,
          ),
          onTap: () => context.push('${tabRoot(context)}/courses/${course.id}'),
        ),
      ),
    );
  }
}
