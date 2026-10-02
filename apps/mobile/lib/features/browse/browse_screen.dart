import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/generated/export.dart';
import '../../data/format.dart';
import '../../data/settings.dart';
import '../../data/taxonomy.dart';
import '../../theme/exam_shape.dart';
import '../../theme/theme.dart';
import '../../widgets/skeleton.dart';
import '../home/search_pill.dart';
import '../../widgets/state_message.dart';

/// Departments, the one with the most papers first and largest.
class BrowseScreen extends ConsumerWidget {
  const BrowseScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: switch (ref.watch(taxonomyProvider)) {
          AsyncData(:final value) => _Departments(
            taxonomy: value,
            mine: ref.watch(myDepartmentProvider),
          ),
          AsyncError(:final error) => StateMessage(
            icon: isOffline(error)
                ? Icons.cloud_off_rounded
                : Icons.error_outline_rounded,
            shape: ExamKind.midterm,
            title: isOffline(error)
                ? "You're offline"
                : "Couldn't load departments",
            body: 'Check your connection and try again.',
            actions: [
              FilledButton(
                onPressed: () => ref.invalidate(taxonomyProvider),
                child: const Text('Try again'),
              ),
            ],
          ),
          _ => Skeleton(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                spacing: 10,
                children: [
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Bone(width: 160, height: 40),
                  ),
                  const Bone(height: 150, radius: 20),
                  for (var i = 0; i < 3; i++)
                    const Row(
                      spacing: 10,
                      children: [
                        Expanded(child: Bone(height: 132, radius: 20)),
                        Expanded(child: Bone(height: 132, radius: 20)),
                      ],
                    ),
                ],
              ),
            ),
          ),
        },
      ),
      backgroundColor: scheme.surface,
    );
  }
}

class _Departments extends StatelessWidget {
  const _Departments({required this.taxonomy, required this.mine});

  final Taxonomy taxonomy;

  /// The reader's department (the one opened last), which leads.
  final int? mine;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final depts = [...taxonomy.departments]
      ..sort(
        (a, b) => a.id == mine
            ? -1
            : b.id == mine
            ? 1
            : b.publishedCount.compareTo(a.publishedCount),
      );
    final courseCounts = <int, int>{};
    for (final c in taxonomy.courses) {
      courseCounts.update(c.departmentId, (n) => n + 1, ifAbsent: () => 1);
    }
    final total = depts.fold(0, (sum, d) => sum + d.publishedCount);
    final rest = depts.skip(1).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        Text('Browse', style: expressive(40, color: scheme.onSurface)),
        const SizedBox(height: 6),
        Text(
          '${plural(depts.length, 'department')}, ${plural(total, 'paper')}',
          style: TextStyle(color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: 16),
        SearchPill(
          label: 'Know the course? Search it',
          onTap: () => context.push('/browse/search'),
        ),
        const SizedBox(height: 16),
        if (depts.isNotEmpty)
          _DepartmentCard(
            depts.first,
            courses: courseCounts[depts.first.id] ?? 0,
            featured: true,
          ),
        for (var i = 0; i < rest.length; i += 2) ...[
          const SizedBox(height: 10),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 10,
              children: [
                Expanded(
                  child: _DepartmentCard(
                    rest[i],
                    courses: courseCounts[rest[i].id] ?? 0,
                  ),
                ),
                Expanded(
                  child: i + 1 < rest.length
                      ? _DepartmentCard(
                          rest[i + 1],
                          courses: courseCounts[rest[i + 1].id] ?? 0,
                        )
                      : const SizedBox(),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _DepartmentCard extends StatelessWidget {
  const _DepartmentCard(
    this.department, {
    required this.courses,
    this.featured = false,
  });

  final DepartmentListItem department;
  final int courses;
  final bool featured;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fg = featured ? scheme.onPrimaryContainer : scheme.onSurface;
    return Material(
      color: featured ? scheme.primaryContainer : scheme.surfaceContainer,
      borderRadius: BorderRadius.circular(20),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/browse/departments/${department.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: featured ? 118 : 100),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              spacing: 10,
              children: [
                Text(
                  department.shortName,
                  style: expressive(
                    featured ? 48 : 34,
                    width: 140,
                    weight: 850,
                    color: fg,
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 2,
                  children: [
                    Text(
                      department.name,
                      style: TextStyle(fontSize: 13, color: fg, height: 1.3),
                    ),
                    Text(
                      '${plural(department.publishedCount, 'paper')} · '
                      '${plural(courses, 'course')}',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: fg,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
