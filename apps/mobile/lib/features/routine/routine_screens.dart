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

// The Class Routine's space (docs/PLAN.md, decisions 29 and 34): Today, Students
// and Teachers tabs in the routine's teal, like the website's three places.

/// The routine's tabs. Until a routine is live in some department (the API
/// answers 404 for each), the space says it's coming soon.
class RoutineShell extends ConsumerWidget {
  const RoutineShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(liveDepartmentsProvider) case AsyncData(value: [])) {
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
              icon: Icon(Icons.today_outlined),
              selectedIcon: Icon(Icons.today_rounded),
              label: 'Today',
            ),
            NavigationDestination(
              icon: Icon(Icons.school_outlined),
              selectedIcon: Icon(Icons.school_rounded),
              label: 'Students',
            ),
            NavigationDestination(
              icon: Icon(Icons.groups_outlined),
              selectedIcon: Icon(Icons.groups_rounded),
              label: 'Teachers',
            ),
          ],
        ),
      ),
    );
  }
}

/// The space's name (the switcher).
class _TopBar extends StatelessWidget {
  const _TopBar();

  @override
  Widget build(BuildContext context) => const SpaceTitle(Space.routine);
}

/// A tab's heading: a large word, and a line about what's shown.
class _Heading extends StatelessWidget {
  const _Heading(this.title, {this.eyebrow});

  final String title;
  final String? eyebrow;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 2,
      children: [
        if (eyebrow != null)
          Text(
            eyebrow!,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: scheme.onSurfaceVariant,
              fontWeight: FontWeight.w600,
            ),
          ),
        Text(title, style: expressive(44, color: scheme.onSurface)),
      ],
    );
  }
}

/// CSE, EEE or SWE, for Students and Teachers; a department without a live routine
/// says "soon".
class _DepartmentPicker extends ConsumerWidget {
  const _DepartmentPicker();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(browseDepartmentProvider);
    return SegmentedButton<RoutineDepartmentSlug>(
      segments: [
        for (final d in routineDepartments)
          ButtonSegment(
            value: d,
            label: Text(switch (ref.watch(routineSectionsProvider(d))) {
              AsyncData() => departmentName(d),
              AsyncError(:final error) when isMissing(error) =>
                '${departmentName(d)} · soon',
              _ => departmentName(d),
            }),
          ),
      ],
      selected: {current},
      showSelectedIcon: false,
      onSelectionChanged: (s) =>
          ref.read(browseDepartmentProvider.notifier).set(s.first),
    );
  }
}

/// A state message inside a scrolling list, which can't size a scroll view of
/// its own.
class _Fill extends StatelessWidget {
  const _Fill(this.child);

  final Widget child;

  @override
  Widget build(BuildContext context) => SizedBox(height: 420, child: child);
}

/// Couldn't load: offline, or another failure, with a way to try again.
Widget _loadError(
  Object error,
  VoidCallback retry, {
  String what = 'routine',
}) => _Fill(
  StateMessage(
    icon: isOffline(error)
        ? Icons.cloud_off_rounded
        : Icons.error_outline_rounded,
    shape: ExamKind.midterm,
    title: isOffline(error) ? "You're offline" : "Couldn't load the $what",
    body: 'Check your connection and try again.',
    actions: [FilledButton(onPressed: retry, child: const Text('Try again'))],
  ),
);

/// A department whose routine isn't out yet.
Widget _comingSoon(RoutineDepartmentSlug d) => _Fill(
  StateMessage(
    icon: Icons.hourglass_empty_rounded,
    shape: ExamKind.midterm,
    title: 'DIU’s ${departmentName(d)} routine is coming soon',
    body: 'Until then, pick another department above.',
  ),
);

const _listSkeleton = Skeleton(
  child: Column(spacing: 10, children: [Bone(height: 120), Bone(height: 120)]),
);

/// Shown when the routine on screen is the phone's copy.
class _OfflineNote extends StatelessWidget {
  const _OfflineNote(this.version);

  final RoutineVersion version;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      spacing: 8,
      children: [
        Icon(Icons.cloud_off_rounded, size: 18, color: scheme.onSurfaceVariant),
        Expanded(
          child: Text(
            'Offline: the routine saved on this phone (v${version.version}).',
            style: TextStyle(color: scheme.onSurfaceVariant),
          ),
        ),
      ],
    );
  }
}

/// The routine changed since the phone last had it: check the week.
class _UpdatedNote extends StatelessWidget {
  const _UpdatedNote({required this.from, required this.to});

  final String from;
  final String to;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      spacing: 8,
      children: [
        Icon(Icons.update_rounded, size: 18, color: scheme.primary),
        Expanded(
          child: Text(
            'The routine was updated: v$from → v$to. Check your week.',
            style: TextStyle(color: scheme.onSurfaceVariant),
          ),
        ),
      ],
    );
  }
}

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

/// Where a saved routine's own screen is.
String _locationOf(SavedRoutine saved) => switch (saved) {
  SavedSection(:final pick) => sectionLocation(pick),
  SavedTeacher(:final pick) => teacherLocation(pick),
};

/// "My section" (or "My routine") pressed again: Today stops showing it, with
/// a way back.
void _forget(BuildContext context, WidgetRef ref, String label) {
  final choice = ref.read(myRoutineChoiceProvider.notifier);
  final was = ref.read(myRoutineChoiceProvider);
  choice.set(null);
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text('$label is no longer your routine.'),
      action: SnackBarAction(label: 'Undo', onPressed: () => choice.set(was)),
    ),
  );
}

// ── Today ────────────────────────────────────────────────────────────────────

/// Today: my routine's day and week; with nothing saved, the two ways to find
/// one.
class RoutineTodayScreen extends ConsumerWidget {
  const RoutineTodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved = ref.watch(myRoutineChoiceProvider);
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(routineSectionProvider);
            ref.invalidate(routineTeacherProvider);
            await ref.read(myRoutineProvider.future).catchError((_) => null);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              const _TopBar(),
              if (saved == null) const _Welcome() else _MyDay(saved),
            ],
          ),
        ),
      ),
    );
  }
}

/// Nothing saved yet: what the space does, and the two ways in.
class _Welcome extends StatelessWidget {
  const _Welcome();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 16,
      children: [
        const SizedBox(height: 16),
        Text(
          'Your class routine.',
          style: expressive(44, color: scheme.onSurface).copyWith(height: 1.0),
        ),
        Text(
          'Today’s classes, the week with rooms and teachers, and a PDF to keep. Find your section or your week, make it yours, and it opens here every day.',
          style: Theme.of(context).textTheme.bodyLarge
              ?.copyWith(color: scheme.onSurfaceVariant),
        ),
        const _WayIn(
          to: '/routine/sections',
          icon: Icons.school_rounded,
          eyebrow: 'For students',
          title: 'Find your section',
          body: 'Your batch’s week and your lab group’s labs, with rooms, teachers and where they sit.',
        ),
        const _WayIn(
          to: '/routine/teachers',
          icon: Icons.groups_rounded,
          eyebrow: 'For teachers, or to find one',
          title: 'Find a teacher',
          body: 'A teacher’s week: every class with its room and the sections attending.',
        ),
      ],
    );
  }
}

class _WayIn extends StatelessWidget {
  const _WayIn({
    required this.to,
    required this.icon,
    required this.eyebrow,
    required this.title,
    required this.body,
  });

  final String to;
  final IconData icon;
  final String eyebrow;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainer,
      borderRadius: BorderRadius.circular(28),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.go(to),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 12,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  color: scheme.primaryContainer,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Icon(icon, color: scheme.onPrimaryContainer),
                ),
              ),
              Text(
                eyebrow,
                style: TextStyle(
                  color: scheme.onSurfaceVariant,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Row(
                spacing: 6,
                children: [
                  Flexible(
                    child: Text(
                      title,
                      style: expressive(26, color: scheme.onSurface),
                    ),
                  ),
                  Icon(Icons.arrow_forward_rounded, color: scheme.onSurface),
                ],
              ),
              Text(body, style: TextStyle(color: scheme.onSurfaceVariant)),
            ],
          ),
        ),
      ),
    );
  }
}

/// My section's or teacher's day: the Today card and the week.
class _MyDay extends ConsumerWidget {
  const _MyDay(this.saved);

  final SavedRoutine saved;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = watchNow(ref);
    final whose = saved is SavedSection ? 'section' : 'week';
    final routine = ref.watch(myRoutineProvider);
    final plan = switch (routine) {
      AsyncData(value: final mine?) => todayPlan(mine.classes, now),
      _ => null,
    };
    return switch (routine) {
      AsyncData(value: final mine?) when plan != null => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 14,
        children: [
          const SizedBox(height: 4),
          if (mine.offline) _OfflineNote(mine.version),
          if (mine.updatedFrom case final from?)
            _UpdatedNote(from: from, to: mine.version.version),
          _Heading(
            'Today',
            eyebrow:
                '${dayName(now.day)} ${now.date.day} ${_months[now.date.month - 1]}',
          ),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: ActionChip(
              avatar: const Icon(Icons.star_rounded, size: 18),
              label: Text(
                '${saved is SavedSection ? 'My section' : 'My routine'} · ${departmentName(saved.department)} ${mine.name}',
              ),
              tooltip: 'Its whole week, courses and PDF',
              onPressed: () => context.go(_locationOf(saved)),
            ),
          ),
          if (mine.section.isEmpty || isRegularSection(mine.section))
            TodayCard(plan: plan, section: mine.section, now: now)
          else
            const _RetakeNote(),
          // The card is now (or next); the list is what comes after it. The
          // week, courses and PDF are on the section's (or teacher's) screen.
          if (plan.list case final list?) ...[
            const SizedBox(height: 4),
            Text(
              list.heading,
              style: Theme.of(context).textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
            DayClasses(
              classes: list.classes,
              section: mine.section,
              department: saved.department,
            ),
          ],
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton.icon(
              onPressed: () => context.go(_locationOf(saved)),
              icon: const Icon(Icons.arrow_forward_rounded),
              label: const Text('Week, courses and PDF'),
            ),
          ),
        ],
      ),
      AsyncError(:final error) when isMissing(error) => _Fill(
        StateMessage(
          icon: Icons.search_off_rounded,
          shape: ExamKind.midterm,
          title: 'Your $whose isn’t in the routine',
          body: switch (saved) {
            SavedSection(:final section, :final group) =>
              'The new routine has no section ${pickLabel(section, group)}. Find your section again.',
            SavedTeacher(:final initials) =>
              'The new routine has no teacher $initials. Find the week again.',
          },
          actions: [
            FilledButton(
              onPressed: () => context.go(
                saved is SavedSection
                    ? '/routine/sections'
                    : '/routine/teachers',
              ),
              child: Text(
                saved is SavedSection ? 'Find your section' : 'Find a teacher',
              ),
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
              onPressed: () {
                ref.invalidate(routineSectionProvider);
                ref.invalidate(routineTeacherProvider);
              },
              child: const Text('Try again'),
            ),
          ],
        ),
      ),
      _ => Skeleton(
        child: Column(
          spacing: 12,
          children: [
            const SizedBox(height: 16),
            const Bone(height: 44, width: 200),
            const Bone(height: 150),
            const Bone(height: 90),
          ],
        ),
      ),
    };
  }
}

// ── Students ─────────────────────────────────────────────────────────────────

/// Students: a department's sections, searched ("67b1" finds lab group B1 of
/// 67_B, "12b" EEE's 1-2 B) or picked from their batch or level and term.
class RoutineSectionsScreen extends ConsumerStatefulWidget {
  const RoutineSectionsScreen({super.key});

  @override
  ConsumerState<RoutineSectionsScreen> createState() =>
      _RoutineSectionsScreenState();
}

class _RoutineSectionsScreenState extends ConsumerState<RoutineSectionsScreen> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _open(RoutineDepartmentSlug d, String section, String? group) => context
      .go(sectionLocation((department: d, section: section, group: group)));

  @override
  Widget build(BuildContext context) {
    final department = ref.watch(browseDepartmentProvider);
    final sections = ref.watch(routineSectionsProvider(department));
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            const _TopBar(),
            const SizedBox(height: 12),
            const _Heading('Students'),
            const SizedBox(height: 16),
            const _DepartmentPicker(),
            const SizedBox(height: 12),
            SearchBar(
              controller: _query,
              hintText: switch (department) {
                RoutineDepartmentSlug.eee =>
                  'Your section, e.g. 1-2 B or 1-2 B1',
                RoutineDepartmentSlug.swe => 'Your section, e.g. 44_G or 44_G1',
                _ => 'Your section, e.g. 67_B or 67_B1',
              },
              leading: const Icon(Icons.search_rounded),
              textCapitalization: TextCapitalization.characters,
              elevation: const WidgetStatePropertyAll(0),
              onChanged: (_) => setState(() {}),
              onSubmitted: (query) {
                final list = sections.value;
                if (list == null) return;
                final first = matchSections(
                  sectionChoices(list.sections),
                  query,
                ).firstOrNull;
                if (first != null) {
                  _open(department, first.section, first.group);
                }
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
              AsyncData(:final value) => _results(department, value),
              AsyncError(:final error) when isMissing(error) => _comingSoon(
                department,
              ),
              AsyncError(:final error) => _loadError(
                error,
                () => ref.invalidate(routineSectionsProvider(department)),
                what: 'sections',
              ),
              _ => _listSkeleton,
            },
          ],
        ),
      ),
    );
  }

  Widget _results(RoutineDepartmentSlug department, RoutineSectionList list) {
    final scheme = Theme.of(context).colorScheme;
    final saved = ref.watch(myRoutineChoiceProvider);
    final mine = saved is SavedSection && saved.department == department
        ? saved.section
        : null;
    if (_query.text.trim().isNotEmpty) {
      final matches = matchSections(sectionChoices(list.sections), _query.text);
      if (matches.isEmpty) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 24),
          child: Text(
            'No section matches “${_query.text.trim()}”. Looking for a teacher? They’re under Teachers.',
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
                subtitle: c.group == null
                    ? null
                    : Text('Lab group ${c.group} of ${c.section}'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => _open(department, c.section, c.group),
              ),
            ),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        for (final group in sectionGroups(list.sections))
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
                        group.title,
                        style: expressive(32, color: scheme.onSurface),
                      ),
                      // "Level 1, term 2" says what "1-2" means; "Batch 67" would only repeat "67".
                      if (group.title.contains('-') && group.name != null)
                        Flexible(
                          child: Text(
                            group.name!,
                            style: TextStyle(color: scheme.onSurfaceVariant),
                          ),
                        ),
                    ],
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final section in group.sections)
                        ChoiceChip(
                          label: Text(
                            group.name == null
                                ? section
                                : sectionGroup(section)?.letter ?? section,
                            semanticsLabel: section,
                          ),
                          selected: mine == section,
                          showCheckmark: false,
                          onSelected: (_) => _open(department, section, null),
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

/// A section's week, with "Make it my section" and the PDF.
class RoutineSectionScreen extends ConsumerStatefulWidget {
  const RoutineSectionScreen({
    super.key,
    required this.department,
    required this.section,
    this.group,
  });

  final RoutineDepartmentSlug department;
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
    final of = (department: widget.department, section: widget.section);
    final routine = ref.watch(routineSectionProvider(of));
    final saved = ref.watch(myRoutineChoiceProvider);
    final pick = (
      department: widget.department,
      section: routine.value?.section ?? widget.section,
      group: _group,
    );
    final label = pickLabel(pick.section, pick.group);
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
              department: widget.department,
              group: _group,
              onGroup: (g) => setState(() => _group = g),
              action: isMySection(saved, pick)
                  ? FilledButton.tonalIcon(
                      onPressed: () => _forget(context, ref, label),
                      icon: const Icon(Icons.star_rounded),
                      label: const Text('My section'),
                    )
                  : FilledButton.icon(
                      onPressed: () {
                        ref
                            .read(myRoutineChoiceProvider.notifier)
                            .set(
                              SavedSection(
                                pick.department,
                                pick.section,
                                pick.group,
                              ),
                            );
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              '$label is your section. Today shows it.',
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
              ? 'Find your section among the ${departmentName(widget.department)} sections.'
              : 'Check your connection and try again.',
          actions: [
            FilledButton(
              onPressed: () => isMissing(error)
                  ? context.go('/routine/sections')
                  : ref.invalidate(routineSectionProvider(of)),
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

/// A section's name, lab groups, week and courses with their teachers.
class _SectionBody extends StatelessWidget {
  const _SectionBody({
    required this.routine,
    required this.department,
    required this.group,
    required this.onGroup,
    required this.action,
  });

  final RoutineSection routine;
  final RoutineDepartmentSlug department;
  final String? group;
  final ValueChanged<String?> onGroup;
  final Widget action;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final classes = classesFor(routine.classes, group);
    final of = sectionGroup(routine.section);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        Text(
          pickLabel(routine.section, group),
          style: expressive(44, color: scheme.onSurface),
        ),
        Text(
          [
            '${departmentName(department)}${of == null ? '' : ' ${of.name.toLowerCase()}, section ${of.letter}'}',
          ].join(' · '),
          style: TextStyle(color: scheme.onSurfaceVariant),
        ),
        action,
        if (routine.labGroups.isNotEmpty) ...[
          GroupChips(routine: routine, group: group, onChanged: onGroup),
          if (group == null)
            Text(
              'Pick your lab group to see only your own labs.',
              style: TextStyle(color: scheme.onSurfaceVariant),
            ),
        ],
        if (!isRegularSection(routine.section)) const _RetakeNote(),
        RoutineWeek(
          key: ValueKey(group),
          classes: classes,
          section: routine.section,
          department: department,
        ),
        const SizedBox(height: 8),
        Text(
          'Courses and teachers',
          style: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        _CourseList(classes, section: routine.section, department: department),
        Text(
          'DIU’s ${departmentName(department)} class routine, version ${routine.version.version}. When a new one comes out, the app follows it.',
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: scheme.onSurfaceVariant),
        ),
      ],
    );
  }
}

/// A section's courses, one row per course and teacher: the course, then who
/// teaches it (and which lab group, when only one). A tap shows where the teacher
/// sits, how to reach them and their week.
class _CourseList extends StatelessWidget {
  const _CourseList(
    this.classes, {
    required this.section,
    required this.department,
  });

  final List<RoutineClass> classes;
  final String section;
  final RoutineDepartmentSlug department;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final codes = {for (final c in classes) c.course.code};
    return RowGroup(
      children: [
        for (final code in codes)
          for (final (course, t, group) in _teachersOf(code))
            Material(
              color: scheme.surfaceContainer,
              child: ListTile(
                title: Text(
                  course.title ?? code,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(
                  [
                    if (course.title != null) code,
                    if (t != null) t.name ?? t.initials,
                    if (group case final g?) '${groupLabel(section, g)} lab',
                  ].join(' · '),
                ),
                trailing: t == null
                    ? null
                    : Icon(Icons.chevron_right_rounded, color: scheme.primary),
                onTap: t == null
                    ? null
                    : () => showTeacherSheet(
                        context,
                        teacher: t,
                        courses: coursesOf(t, classes),
                        department: department,
                      ),
              ),
            ),
      ],
    );
  }

  /// A course's teachers (or none), each with the lab group they have when
  /// they teach only that group's labs.
  List<(RoutineCourse, RoutineTeacher?, String?)> _teachersOf(String code) {
    final of = [
      for (final c in classes)
        if (c.course.code == code) c,
    ];
    final teachers = {
      for (final t in of.map((c) => c.teacher).nonNulls) t.initials: t,
    }.values;
    if (teachers.isEmpty) return [(of.first.course, null, null)];
    return [
      for (final t in teachers)
        (
          of.first.course,
          t,
          switch ({
            for (final c in of)
              if (c.teacher?.initials == t.initials) c.labGroup,
          }) {
            final groups when groups.length == 1 => groups.first,
            _ => null,
          },
        ),
    ];
  }
}

// ── Teachers ─────────────────────────────────────────────────────────────────

/// Teachers: a department's teachers, filtered as you type by initials or name.
class RoutineTeachersScreen extends ConsumerStatefulWidget {
  const RoutineTeachersScreen({super.key});

  @override
  ConsumerState<RoutineTeachersScreen> createState() =>
      _RoutineTeachersScreenState();
}

class _RoutineTeachersScreenState extends ConsumerState<RoutineTeachersScreen> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _open(RoutineDepartmentSlug d, String initials) =>
      context.go(teacherLocation((department: d, initials: initials)));

  @override
  Widget build(BuildContext context) {
    final department = ref.watch(browseDepartmentProvider);
    final teachers = ref.watch(routineTeachersProvider(department));
    final all = teachers.value?.teachers ?? const <RoutineTeacherSummary>[];
    final shown = matchTeachers(all, _query.text);
    final named = all.any((t) => t.name != null);
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            const _TopBar(),
            const SizedBox(height: 12),
            const _Heading('Teachers'),
            const SizedBox(height: 16),
            const _DepartmentPicker(),
            const SizedBox(height: 12),
            SearchBar(
              controller: _query,
              hintText:
                  'Initials${named ? ' or name' : ''}, e.g. ${all.firstOrNull?.initials ?? 'STA'}',
              leading: const Icon(Icons.search_rounded),
              elevation: const WidgetStatePropertyAll(0),
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) {
                if (shown.firstOrNull case final t?) {
                  _open(department, t.initials);
                }
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
            switch (teachers) {
              AsyncData() => _list(department, all, shown),
              AsyncError(:final error) when isMissing(error) => _comingSoon(
                department,
              ),
              AsyncError(:final error) => _loadError(
                error,
                () => ref.invalidate(routineTeachersProvider(department)),
                what: 'teachers',
              ),
              _ => _listSkeleton,
            },
          ],
        ),
      ),
    );
  }

  Widget _list(
    RoutineDepartmentSlug department,
    List<RoutineTeacherSummary> all,
    List<RoutineTeacherSummary> shown,
  ) {
    final scheme = Theme.of(context).colorScheme;
    final saved = ref.watch(myRoutineChoiceProvider);
    if (shown.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Text(
          'No ${departmentName(department)} teacher matches “${_query.text.trim()}”. Try their initials as the routine prints them.',
          style: TextStyle(color: scheme.onSurfaceVariant),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        Text(
          _query.text.trim().isEmpty
              ? '${plural(all.length, 'teacher')}, by initials'
              : '${shown.length} of ${plural(all.length, 'teacher')}',
          style: TextStyle(color: scheme.onSurfaceVariant),
        ),
        RowGroup(
          children: [
            for (final t in shown)
              Builder(
                builder: (context) {
                  final mine = isMyTeacher(saved, (
                    department: department,
                    initials: t.initials,
                  ));
                  return Material(
                    color: mine
                        ? scheme.primaryContainer
                        : scheme.surfaceContainer,
                    child: ListTile(
                      title: Text(
                        teacherName(t.initials, t.name),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        [
                          if (t.name != null) t.initials,
                          t.courses.join(', '),
                        ].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      onTap: () => _open(department, t.initials),
                    ),
                  );
                },
              ),
          ],
        ),
      ],
    );
  }
}

/// A teacher's week: where they sit and how to reach them, the week with
/// the sections attending each class, and their courses' sections.
class RoutineTeacherScreen extends ConsumerWidget {
  const RoutineTeacherScreen({
    super.key,
    required this.department,
    required this.initials,
  });

  final RoutineDepartmentSlug department;
  final String initials;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asked = (department: department, initials: initials);
    final week = ref.watch(routineTeacherProvider(asked));
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        actions: [
          IconButton(
            tooltip: 'Share link',
            icon: const Icon(Icons.share_outlined),
            onPressed: () => SharePlus.instance.share(
              ShareParams(
                uri: teacherPageUrl((
                  department: department,
                  initials: week.value?.teacher.initials ?? initials,
                )),
              ),
            ),
          ),
          if (week.value case final w?)
            Builder(
              builder: (button) => IconButton(
                tooltip: 'Routine PDF',
                icon: const Icon(Icons.file_download_outlined),
                onPressed: () => shareTeacherPdf(button, ref, w),
              ),
            ),
        ],
      ),
      body: switch (week) {
        AsyncData(:final value) => Builder(
          builder: (context) {
            final teacher = value.teacher;
            final pick = (department: department, initials: teacher.initials);
            final classes = [for (final c in value.classes) AttendedClass(c)];
            final saved = ref.watch(myRoutineChoiceProvider);
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: 14,
                  children: [
                    Text(
                      teacherName(teacher.initials, teacher.name),
                      style: expressive(
                        teacher.name == null ? 44 : 34,
                        color: scheme.onSurface,
                      ),
                    ),
                    Text(
                      [
                        if (teacher.name != null) teacher.initials,
                        '${departmentName(department)} teacher',
                      ].join(' · '),
                      style: TextStyle(color: scheme.onSurfaceVariant),
                    ),
                    TeacherContact(teacher),
                    if (isMyTeacher(saved, pick))
                      FilledButton.tonalIcon(
                        onPressed: () =>
                            _forget(context, ref, teacher.initials),
                        icon: const Icon(Icons.star_rounded),
                        label: const Text('My routine'),
                      )
                    else
                      FilledButton.icon(
                        onPressed: () {
                          ref
                              .read(myRoutineChoiceProvider.notifier)
                              .set(SavedTeacher(department, teacher.initials));
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                '${teacherName(teacher.initials, teacher.name)}’s week is your routine. Today shows it.',
                              ),
                            ),
                          );
                          context.go('/routine');
                        },
                        icon: const Icon(Icons.star_outline_rounded),
                        label: const Text('Make it my routine'),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      'The week',
                      style: Theme.of(context).textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    RoutineWeek(
                      classes: classes,
                      section: '',
                      department: department,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Courses and sections',
                      style: Theme.of(context).textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    _TeacherCourses(value.classes, department: department),
                    Text(
                      'DIU’s ${departmentName(department)} class routine, version ${value.version.version}. When a new one comes out, the app follows it.',
                      style: Theme.of(context).textTheme.bodySmall
                          ?.copyWith(color: scheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ],
            );
          },
        ),
        AsyncError(:final error) => StateMessage(
          icon: isMissing(error)
              ? Icons.search_off_rounded
              : isOffline(error)
              ? Icons.cloud_off_rounded
              : Icons.error_outline_rounded,
          shape: ExamKind.midterm,
          title: isMissing(error)
              ? '$initials isn’t in the routine'
              : isOffline(error)
              ? "You're offline"
              : "Couldn't load the routine",
          body: isMissing(error)
              ? 'Find the teacher among the ${departmentName(department)} teachers.'
              : 'Check your connection and try again.',
          actions: [
            FilledButton(
              onPressed: () => isMissing(error)
                  ? context.go('/routine/teachers')
                  : ref.invalidate(routineTeacherProvider(asked)),
              child: Text(isMissing(error) ? 'Find a teacher' : 'Try again'),
            ),
          ],
        ),
        _ => const Skeleton(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              spacing: 12,
              children: [
                Bone(height: 44, width: 220),
                Bone(height: 60),
                Bone(height: 150),
                Bone(height: 90),
              ],
            ),
          ),
        ),
      },
    );
  }
}

/// A teacher's courses, each with the sections taking it: a chip opens a
/// section's week.
class _TeacherCourses extends StatelessWidget {
  const _TeacherCourses(this.classes, {required this.department});

  final List<RoutineTeacherClass> classes;
  final RoutineDepartmentSlug department;

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
              final attending = {
                for (final c in of)
                  for (final s in c.sections)
                    pickLabel(s.section, s.labGroup): s,
              }.entries.toList()..sort((a, b) => a.key.compareTo(b.key));
              return Material(
                color: scheme.surfaceContainer,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 10,
                    children: [
                      Text(
                        course.title ?? code,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (course.title != null)
                        Text(
                          code,
                          style: TextStyle(color: scheme.onSurfaceVariant),
                        ),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final MapEntry(key: label, value: s)
                              in attending)
                            ActionChip(
                              label: Text(label),
                              onPressed: () => context.go(
                                sectionLocation((
                                  department: department,
                                  section: s.section,
                                  group: s.labGroup,
                                )),
                              ),
                            ),
                        ],
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
}
