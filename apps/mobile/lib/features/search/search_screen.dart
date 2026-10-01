import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/generated/export.dart';
import '../../data/settings.dart';
import '../../data/taxonomy.dart';
import '../../theme/exam_shape.dart';
import '../../widgets/state_message.dart';
import '../home/search_pill.dart';

/// Courses whose name contains every word typed, in any order, ignoring case
/// ("math 1" finds "Mathematics I" only if both words match). Best matches
/// (name starts with the query) first.
List<Course> searchCourses(List<Course> courses, String query) {
  final words = query
      .toLowerCase()
      .split(RegExp(r'\s+'))
      .where((w) => w.isNotEmpty)
      .toList();
  if (words.isEmpty) return const [];
  final hits = courses.where((c) {
    final name = c.name.toLowerCase();
    return words.every(name.contains);
  }).toList();
  final q = query.trim().toLowerCase();
  hits.sort((a, b) {
    final startsA = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    final startsB = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    return startsA != startsB ? startsA - startsB : a.name.compareTo(b.name);
  });
  return hits;
}

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _open(Course course) {
    ref.read(recentCoursesProvider.notifier).add(course.id);
    context.push('/home/courses/${course.id}');
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final taxonomy = ref.watch(taxonomyProvider).value;
    final departments = {
      for (final d in taxonomy?.departments ?? const <DepartmentListItem>[])
        d.id: d,
    };
    final query = _controller.text;
    final hits = searchCourses(taxonomy?.courses ?? const [], query);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Hero(
          tag: SearchPill.heroTag,
          child: Material(
            color: scheme.surfaceContainerHigh,
            shape: const StadiumBorder(),
            child: TextField(
              controller: _controller,
              autofocus: true,
              textInputAction: TextInputAction.search,
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) {
                if (hits.isNotEmpty) _open(hits.first);
              },
              decoration: InputDecoration(
                hintText: 'Course name',
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 14,
                ),
                suffixIcon: query.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Clear',
                        onPressed: () => setState(_controller.clear),
                        icon: const Icon(Icons.close_rounded),
                      ),
              ),
            ),
          ),
        ),
        actions: const [SizedBox(width: 12)],
      ),
      body: query.trim().isEmpty
          ? _Recent(
              courses: [
                for (final id in ref.watch(recentCoursesProvider))
                  ?taxonomy?.courses.where((c) => c.id == id).firstOrNull,
              ],
              onOpen: _open,
            )
          : hits.isEmpty
          ? StateMessage(
              icon: Icons.search_off_rounded,
              shape: ExamKind.quiz,
              title: 'No course matches “${query.trim()}”',
              body: 'Check the spelling, or browse courses by department.',
              actions: [
                FilledButton.tonal(
                  onPressed: () => context.go('/browse'),
                  child: const Text('Browse departments'),
                ),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: hits.length,
              separatorBuilder: (_, _) => const SizedBox(height: 2),
              itemBuilder: (context, i) {
                final course = hits[i];
                final dept = departments[course.departmentId];
                return Material(
                  color: scheme.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(
                    i == 0 || i == hits.length - 1 ? 20 : 4,
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: ListTile(
                    leading: Icon(
                      Icons.menu_book_rounded,
                      color: scheme.onSurfaceVariant,
                    ),
                    title: _Highlighted(course.name, query),
                    subtitle: dept == null
                        ? null
                        : Text('${dept.shortName} · ${dept.name}'),
                    trailing: Icon(
                      Icons.north_west_rounded,
                      color: scheme.onSurfaceVariant,
                    ),
                    onTap: () => _open(course),
                  ),
                );
              },
            ),
    );
  }
}

class _Recent extends StatelessWidget {
  const _Recent({required this.courses, required this.onOpen});

  final List<Course> courses;
  final ValueChanged<Course> onOpen;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (courses.isNotEmpty) ...[
          Text(
            'Recent',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final c in courses)
                ActionChip(
                  avatar: const Icon(Icons.history_rounded, size: 18),
                  label: Text(c.name),
                  onPressed: () => onOpen(c),
                ),
            ],
          ),
          const SizedBox(height: 20),
        ],
        Text(
          'Type part of a course name, like “math”, “data” or “network”.',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

/// The course name with the typed words highlighted.
class _Highlighted extends StatelessWidget {
  const _Highlighted(this.text, this.query);

  final String text;
  final String query;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final words = query
        .toLowerCase()
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty);
    final marked = List.filled(text.length, false);
    final lower = text.toLowerCase();
    for (final w in words) {
      for (var i = lower.indexOf(w); i >= 0; i = lower.indexOf(w, i + 1)) {
        marked.fillRange(i, i + w.length, true);
      }
    }
    final spans = <TextSpan>[];
    for (var i = 0; i < text.length;) {
      var j = i;
      while (j < text.length && marked[j] == marked[i]) {
        j++;
      }
      spans.add(
        TextSpan(
          text: text.substring(i, j),
          style: marked[i]
              ? TextStyle(
                  backgroundColor: scheme.primaryContainer,
                  color: scheme.onPrimaryContainer,
                  fontWeight: FontWeight.w600,
                )
              : null,
        ),
      );
      i = j;
    }
    return Text.rich(TextSpan(children: spans));
  }
}
