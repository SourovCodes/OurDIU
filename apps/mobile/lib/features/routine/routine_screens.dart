import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../api/generated/export.dart';
import '../../data/format.dart';
import '../../data/routine.dart';
import '../../spaces/coming_soon_screen.dart';
import '../../spaces/space.dart';
import '../../spaces/switcher.dart';
import '../../theme/exam_shape.dart';
import '../../theme/theme.dart';
import '../../widgets/question_row.dart';
import '../../widgets/skeleton.dart';
import '../../widgets/state_message.dart';
import 'routine_widgets.dart';
import 'teacher_sheet.dart';

// The Class Routine's space (docs/PLAN.md, decision 29): Today, Week and Find tabs
// in the routine's teal, like the Question Bank's own tabs.

/// The routine's tabs. Until a routine is live (the API answers 404), the space
/// says it's coming soon.
class RoutineShell extends ConsumerWidget {
  const RoutineShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sections = ref.watch(routineSectionsProvider);
    if (sections.error case final error? when isMissing(error)) {
      return const ComingSoonScreen(Space.routine);
    }
    return Theme(
      data: Space.routine.theme(context),
      child: Scaffold(
        body: shell,
        bottomNavigationBar: NavigationBar(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: (i) =>
              shell.goBranch(i, initialLocation: i == shell.currentIndex),
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.schedule_outlined),
              selectedIcon: Icon(Icons.schedule_rounded),
              label: 'Today',
            ),
            NavigationDestination(
              icon: Icon(Icons.calendar_view_week_outlined),
              selectedIcon: Icon(Icons.calendar_view_week_rounded),
              label: 'Week',
            ),
            NavigationDestination(
              icon: Icon(Icons.search_rounded),
              selectedIcon: Icon(Icons.manage_search_rounded),
              label: 'Find',
            ),
          ],
        ),
      ),
    );
  }
}

/// The space's name (the switcher), and an action on the right.
class _TopBar extends StatelessWidget {
  const _TopBar({this.trailing});

  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Expanded(child: SpaceTitle(Space.routine)),
      ?trailing,
    ],
  );
}

/// The section a tab shows; tapping it leads to Find to change it.
class _SectionChip extends StatelessWidget {
  const _SectionChip(this.pick);

  final RoutinePick pick;

  @override
  Widget build(BuildContext context) => ActionChip(
    avatar: const Icon(Icons.star_rounded, size: 18),
    label: Text(pickLabel(pick)),
    tooltip: 'Change your section',
    onPressed: () => context.go('/routine/find'),
  );
}

/// No section chosen yet: what the space does, and the way to Find.
class _PickSection extends StatelessWidget {
  const _PickSection();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 16,
      children: [
        const SizedBox(height: 24),
        Text(
          'Your class routine.',
          style: expressive(44, color: scheme.onSurface).copyWith(height: 1.0),
        ),
        Text(
          'Find your section in DIU’s CSE routine: today’s classes, your week with rooms and teachers, and a PDF to keep. Pick your lab group too, so you only see your own labs.',
          style: Theme.of(context).textTheme.bodyLarge
              ?.copyWith(color: scheme.onSurfaceVariant),
        ),
        FilledButton.icon(
          onPressed: () => context.go('/routine/find'),
          icon: const Icon(Icons.search_rounded),
          label: const Text('Find your section'),
        ),
      ],
    );
  }
}

/// My section's routine for Today and Week, or why it isn't there.
Widget _withMyRoutine(
  BuildContext context,
  WidgetRef ref,
  Widget Function(MyRoutine mine) builder,
) {
  final pick = ref.watch(mySectionProvider);
  if (pick == null) return const _PickSection();
  return switch (ref.watch(myRoutineProvider)) {
    AsyncData(value: final mine?) => builder(mine),
    AsyncError(:final error) when isMissing(error) => _Fill(
      StateMessage(
        icon: Icons.search_off_rounded,
        shape: ExamKind.midterm,
        title: '${pickLabel(pick)} isn’t in the routine',
        body:
            'The new routine has no section ${pick.section}. Find your section again.',
        actions: [
          FilledButton(
            onPressed: () => context.go('/routine/find'),
            child: const Text('Find your section'),
          ),
        ],
      ),
    ),
    AsyncError(:final error) => _Fill(
      StateMessage(
        icon: isOffline(error)
            ? Icons.cloud_off_rounded
            : Icons.error_outline_rounded,
        shape: ExamKind.midterm,
        title: isOffline(error)
            ? "You're offline"
            : "Couldn't load the routine",
        body: 'Your routine is kept on the phone once it has loaded. Connect and try again.',
        actions: [
          FilledButton(
            onPressed: () => ref.invalidate(routineSectionProvider),
            child: const Text('Try again'),
          ),
        ],
      ),
    ),
    _ => const Skeleton(
      child: Column(
        spacing: 12,
        children: [
          SizedBox(height: 16),
          Bone(height: 44, width: 200),
          Bone(height: 150),
          Bone(height: 90),
          Bone(height: 90),
        ],
      ),
    ),
  };
}

/// A state message inside a scrolling list, which can't size a scroll view of
/// its own.
class _Fill extends StatelessWidget {
  const _Fill(this.child);

  final Widget child;

  @override
  Widget build(BuildContext context) => SizedBox(height: 480, child: child);
}

/// Shown when the routine on screen is the phone's copy.
class _OfflineNote extends StatelessWidget {
  const _OfflineNote(this.routine);

  final RoutineSection routine;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      spacing: 8,
      children: [
        Icon(Icons.cloud_off_rounded, size: 18, color: scheme.onSurfaceVariant),
        Expanded(
          child: Text(
            'Offline: the routine saved on this phone (v${routine.version.version}).',
            style: TextStyle(color: scheme.onSurfaceVariant),
          ),
        ),
      ],
    );
  }
}

Future<void> _refresh(WidgetRef ref) async {
  ref.invalidate(routineSectionsProvider);
  ref.invalidate(routineSectionProvider);
  await ref.read(myRoutineProvider.future).catchError((_) => null);
}

/// Today: the class you're in or the next one, and the rest of today.
class RoutineTodayScreen extends ConsumerWidget {
  const RoutineTodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(myRoutineProvider, (_, next) {
      if (next.value?.updatedFrom case final from?) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'The routine was updated: v$from → v${next.value!.routine.version.version}. Check your week.',
            ),
          ),
        );
      }
    });
    final scheme = Theme.of(context).colorScheme;
    final now = watchNow(ref);
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => _refresh(ref),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              const _TopBar(),
              _withMyRoutine(context, ref, (mine) {
                final classes = classesFor(
                  mine.routine.classes,
                  mine.pick.group,
                );
                final todays = [
                  for (final c in classes)
                    if (c.day == now.day) c,
                ];
                final date = now.date;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: 14,
                  children: [
                    const SizedBox(height: 4),
                    if (mine.offline) _OfflineNote(mine.routine),
                    Text(
                      dayName(now.day),
                      style: expressive(44, color: scheme.onSurface),
                    ),
                    Row(
                      spacing: 8,
                      children: [
                        Expanded(
                          child: Text(
                            [
                              '${date.day} ${_months[date.month - 1]}',
                              if (todays.isNotEmpty)
                                plural(todays.length, 'class', 'classes'),
                            ].join(' · '),
                            style: TextStyle(color: scheme.onSurfaceVariant),
                          ),
                        ),
                        _SectionChip(mine.pick),
                      ],
                    ),
                    if (isRegularSection(mine.routine.section))
                      TodayCard(
                        classes: classes,
                        section: mine.routine.section,
                        now: now,
                      )
                    else
                      const _RetakeNote(),
                    if (todays.isNotEmpty) ...[
                      Text(
                        'Today’s classes',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      DayClasses(
                        classes: todays,
                        section: mine.routine.section,
                        now: now,
                      ),
                    ],
                  ],
                );
              }),
            ],
          ),
        ),
      ),
    );
  }
}

const _months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

class _RetakeNote extends StatelessWidget {
  const _RetakeNote();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.primaryContainer,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(
          'A retake section gathers the classes of several courses, often at the same time. You attend only the courses you’re retaking.',
          style: TextStyle(color: scheme.onPrimaryContainer),
        ),
      ),
    );
  }
}

/// Week: my section's days, its lab group, and the PDF.
class RoutineWeekScreen extends ConsumerWidget {
  const RoutineWeekScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mine = ref.watch(myRoutineProvider).value;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => _refresh(ref),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              _TopBar(
                trailing: mine == null
                    ? null
                    : IconButton(
                        tooltip: 'Routine PDF',
                        icon: const Icon(Icons.file_download_outlined),
                        onPressed: () => showRoutinePdfSheet(
                          context,
                          ref,
                          routine: mine.routine,
                          group: mine.pick.group,
                        ),
                      ),
              ),
              _withMyRoutine(
                context,
                ref,
                (mine) => _SectionBody(
                  routine: mine.routine,
                  group: mine.pick.group,
                  offline: mine.offline,
                  onGroup: (g) => ref.read(mySectionProvider.notifier).set((
                    section: mine.pick.section,
                    group: g,
                  )),
                  action: Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: TextButton.icon(
                      onPressed: () => context.go('/routine/find'),
                      icon: const Icon(Icons.swap_horiz_rounded),
                      label: const Text('Change section'),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A section's name, lab groups and week, on Week and on a found section.
class _SectionBody extends StatelessWidget {
  const _SectionBody({
    required this.routine,
    required this.group,
    required this.onGroup,
    this.offline = false,
    this.action,
  });

  final RoutineSection routine;
  final String? group;
  final ValueChanged<String?> onGroup;
  final bool offline;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final classes = classesFor(routine.classes, group);
    final courses = {for (final c in classes) c.course.code}.length;
    final batch = RegExp(r'^(\d+)_([A-Za-z]+)$').firstMatch(routine.section);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        const SizedBox(height: 4),
        if (offline) _OfflineNote(routine),
        Text(
          pickLabel((section: routine.section, group: group)),
          style: expressive(44, color: scheme.onSurface),
        ),
        Text(
          [
            if (batch != null) 'Batch ${batch[1]}, section ${batch[2]}',
            plural(courses, 'course'),
            '${plural(classes.length, 'class', 'classes')} a week',
          ].join(' · '),
          style: TextStyle(color: scheme.onSurfaceVariant),
        ),
        ?action,
        if (routine.labGroups.isNotEmpty) ...[
          GroupChips(routine: routine, group: group, onChanged: onGroup),
          if (group == null)
            Text(
              'Pick your lab group to see only your own labs.',
              style: TextStyle(color: scheme.onSurfaceVariant),
            ),
        ],
        if (!isRegularSection(routine.section)) const _RetakeNote(),
        SectionWeek(routine: routine, group: group),
        const SizedBox(height: 8),
        Text(
          'Courses and teachers',
          style: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        _CourseList(classes, section: routine.section),
        Text(
          'DIU’s ${routine.version.department.json} class routine, version ${routine.version.version}. When a new one comes out, the app follows it.',
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: scheme.onSurfaceVariant),
        ),
      ],
    );
  }
}

/// A section's courses, each with its teachers: which lab group a teacher has when
/// they teach one group's labs, where they sit, and a tap for how to reach them.
class _CourseList extends StatelessWidget {
  const _CourseList(this.classes, {required this.section});

  final List<RoutineClass> classes;
  final String section;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final codes = {for (final c in classes) c.course.code};
    return RowGroup(
      children: [
        for (final code in codes)
          Builder(
            builder: (context) {
              final of = [
                for (final c in classes)
                  if (c.course.code == code) c,
              ];
              final course = of.first.course;
              final teachers = {
                for (final t in of.map((c) => c.teacher).nonNulls)
                  t.initials: t,
              }.values;
              return Material(
                color: scheme.surfaceContainer,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ListTile(
                        title: Text(
                          course.title ?? code,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        subtitle: Text(
                          [
                            if (course.title != null) code,
                            '${of.length} a week',
                          ].join(' · '),
                        ),
                      ),
                      for (final t in teachers)
                        _TeacherRow(
                          teacher: t,
                          group: _onlyGroup(of, t),
                          section: section,
                          courses: coursesOf(t, classes),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
      ],
    );
  }

  /// The lab group a teacher has in a course, when they teach only that group.
  static String? _onlyGroup(List<RoutineClass> of, RoutineTeacher t) {
    final groups = {
      for (final c in of)
        if (c.teacher?.initials == t.initials) c.labGroup,
    };
    return groups.length == 1 ? groups.first : null;
  }
}

/// A course's teacher: tap for where they sit and how to reach them.
class _TeacherRow extends StatelessWidget {
  const _TeacherRow({
    required this.teacher,
    required this.group,
    required this.section,
    required this.courses,
  });

  final RoutineTeacher teacher;
  final String? group;
  final String section;
  final List<String> courses;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final t = teacher;
    final contact = t.email != null || t.phone != null;
    return ListTile(
      dense: true,
      visualDensity: VisualDensity.compact,
      leading: Icon(
        Icons.person_outline_rounded,
        color: scheme.onSurfaceVariant,
      ),
      minLeadingWidth: 20,
      title: Text(
        [
          t.name ?? t.initials,
          if (t.name != null) t.initials,
          if (group case final g?) '${groupLabel(section, g)} lab',
        ].join(' · '),
      ),
      subtitle: t.room == null ? null : Text('Sits in ${t.room}'),
      trailing: contact
          ? Icon(Icons.contact_mail_outlined, color: scheme.primary)
          : null,
      onTap: t.name == null && t.room == null && !contact
          ? null
          : () => showTeacherSheet(context, teacher: t, courses: courses),
    );
  }
}

/// Find: search a section ("67b1" finds lab group B1 of 67_B), or pick it from
/// its batch.
class RoutineFindScreen extends ConsumerStatefulWidget {
  const RoutineFindScreen({super.key});

  @override
  ConsumerState<RoutineFindScreen> createState() => _RoutineFindScreenState();
}

class _RoutineFindScreenState extends ConsumerState<RoutineFindScreen> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _open(String section, String? group) => context.go(
    Uri(
      path: '/routine/find/${Uri.encodeComponent(section)}',
      queryParameters: group == null ? null : {'group': group},
    ).toString(),
  );

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final sections = ref.watch(routineSectionsProvider);
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            const _TopBar(),
            const SizedBox(height: 12),
            Text(
              'Find your section',
              style: expressive(36, color: scheme.onSurface),
            ),
            const SizedBox(height: 16),
            SearchBar(
              controller: _query,
              hintText: 'e.g. 67_B or 67_B1',
              leading: const Icon(Icons.search_rounded),
              textCapitalization: TextCapitalization.characters,
              elevation: const WidgetStatePropertyAll(0),
              onChanged: (_) => setState(() {}),
              onSubmitted: (query) {
                final list = ref.read(routineSectionsProvider).value;
                if (list == null) return;
                final first = matchSections(
                  sectionChoices(list.sections),
                  query,
                ).firstOrNull;
                if (first != null) _open(first.section, first.group);
              },
              trailing: [
                if (_query.text.isNotEmpty)
                  IconButton(
                    tooltip: 'Clear',
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => setState(_query.clear),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            switch (sections) {
              AsyncData(:final value) => _results(value),
              AsyncError(:final error) => _Fill(
                StateMessage(
                  icon: isOffline(error)
                      ? Icons.cloud_off_rounded
                      : Icons.error_outline_rounded,
                  shape: ExamKind.midterm,
                  title: isOffline(error)
                      ? "You're offline"
                      : "Couldn't load the sections",
                  body: 'Check your connection and try again.',
                  actions: [
                    FilledButton(
                      onPressed: () => ref.invalidate(routineSectionsProvider),
                      child: const Text('Try again'),
                    ),
                  ],
                ),
              ),
              _ => const Skeleton(
                child: Column(
                  spacing: 10,
                  children: [Bone(height: 120), Bone(height: 120)],
                ),
              ),
            },
          ],
        ),
      ),
    );
  }

  Widget _results(RoutineSectionList list) {
    final scheme = Theme.of(context).colorScheme;
    final mine = ref.watch(mySectionProvider);
    if (_query.text.trim().isNotEmpty) {
      final matches = matchSections(sectionChoices(list.sections), _query.text);
      if (matches.isEmpty) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 24),
          child: Text(
            'No section matches “${_query.text.trim()}”. Sections look like 67_B; lab groups like 67_B1.',
            style: TextStyle(color: scheme.onSurfaceVariant),
          ),
        );
      }
      return RowGroup(
        children: [
          for (final c in matches)
            Material(
              color: scheme.surfaceContainer,
              child: ListTile(
                title: Text(
                  c.label,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(
                  c.group == null
                      ? '${c.classCount} classes a week'
                      : 'Lab group ${c.group} of ${c.section}',
                ),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => _open(c.section, c.group),
              ),
            ),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        Text(
          'CSE routine v${list.version.version} · ${list.sections.length} sections',
          style: TextStyle(color: scheme.onSurfaceVariant),
        ),
        for (final (:batch, :sections) in sectionsByBatch(list.sections))
          DecoratedBox(
            decoration: BoxDecoration(
              color: scheme.surfaceContainer,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 12,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    spacing: 10,
                    children: [
                      Text(
                        batch.isEmpty ? 'Retakes' : batch,
                        style: expressive(32, color: scheme.onSurface),
                      ),
                      Text(
                        '${batch.isEmpty ? 'and others' : 'Batch'} · ${plural(sections.length, 'section')}',
                        style: TextStyle(color: scheme.onSurfaceVariant),
                      ),
                    ],
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final section in sections)
                        ChoiceChip(
                          label: Text(
                            batch.isEmpty
                                ? section
                                : section.substring(batch.length + 1),
                            semanticsLabel: section,
                          ),
                          selected: mine?.section == section,
                          showCheckmark: false,
                          onSelected: (_) => _open(section, null),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// A section found in Find: its week, with "Make it my section" and the PDF.
class RoutineSectionScreen extends ConsumerStatefulWidget {
  const RoutineSectionScreen({super.key, required this.section, this.group});

  final String section;
  final String? group;

  @override
  ConsumerState<RoutineSectionScreen> createState() =>
      _RoutineSectionScreenState();
}

class _RoutineSectionScreenState extends ConsumerState<RoutineSectionScreen> {
  late String? _group = widget.group;

  @override
  Widget build(BuildContext context) {
    final routine = ref.watch(routineSectionProvider(widget.section));
    final mine = ref.watch(mySectionProvider);
    final pick = (section: widget.section, group: _group);
    final isMine = mine?.section == pick.section && mine?.group == pick.group;
    return Scaffold(
      // The section's name is the page's heading, large, just below.
      appBar: AppBar(
        actions: [
          IconButton(
            tooltip: 'Share link',
            icon: const Icon(Icons.share_outlined),
            onPressed: () => SharePlus.instance.share(
              ShareParams(uri: routinePageUrl(pick)),
            ),
          ),
          if (routine.value case final r?)
            IconButton(
              tooltip: 'Routine PDF',
              icon: const Icon(Icons.file_download_outlined),
              onPressed: () =>
                  showRoutinePdfSheet(context, ref, routine: r, group: _group),
            ),
        ],
      ),
      body: switch (routine) {
        AsyncData(:final value) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            _SectionBody(
              routine: value,
              group: _group,
              onGroup: (g) => setState(() => _group = g),
              action: isMine
                  ? FilledButton.tonalIcon(
                      onPressed: () => context.go('/routine'),
                      icon: const Icon(Icons.star_rounded),
                      label: const Text('My section · open Today'),
                    )
                  : FilledButton.icon(
                      onPressed: () {
                        ref.read(mySectionProvider.notifier).set(pick);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              '${pickLabel(pick)} is your section. Today and Week show it.',
                            ),
                          ),
                        );
                        context.go('/routine');
                      },
                      icon: const Icon(Icons.star_outline_rounded),
                      label: const Text('Make it my section'),
                    ),
            ),
          ],
        ),
        AsyncError(:final error) => StateMessage(
          icon: isMissing(error)
              ? Icons.search_off_rounded
              : isOffline(error)
              ? Icons.cloud_off_rounded
              : Icons.error_outline_rounded,
          shape: ExamKind.midterm,
          title: isMissing(error)
              ? '${widget.section} isn’t in the routine'
              : isOffline(error)
              ? "You're offline"
              : "Couldn't load the routine",
          body: isMissing(error)
              ? 'Sections look like 67_B; lab groups like 67_B1.'
              : 'Check your connection and try again.',
          actions: [
            FilledButton(
              onPressed: () => isMissing(error)
                  ? context.go('/routine/find')
                  : ref.invalidate(routineSectionProvider(widget.section)),
              child: Text(isMissing(error) ? 'Find your section' : 'Try again'),
            ),
          ],
        ),
        _ => const Skeleton(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              spacing: 12,
              children: [
                Bone(height: 44, width: 160),
                Bone(height: 60),
                Bone(height: 90),
                Bone(height: 90),
              ],
            ),
          ),
        ),
      },
    );
  }
}
