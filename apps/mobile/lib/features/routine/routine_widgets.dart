import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../api/api.dart';
import '../../api/generated/export.dart';
import '../../data/format.dart';
import '../../data/routine.dart';
import '../../theme/exam_shape.dart';
import '../../theme/theme.dart';
import '../../widgets/question_row.dart';
import '../questions/paper_actions.dart';
import 'teacher_sheet.dart';

/// The time in Dhaka, ticking every 15 seconds so "Now" and "Next" stay true.
final dhakaClockProvider = StreamProvider<DhakaNow>((ref) async* {
  yield dhakaNow();
  yield* Stream.periodic(const Duration(seconds: 15), (_) => dhakaNow());
});

/// The current time for a screen: the clock's, or a fresh reading before its
/// first tick.
DhakaNow watchNow(WidgetRef ref) =>
    ref.watch(dhakaClockProvider).value ?? dhakaNow();

String _wait(int minutes) {
  if (minutes < 60) return '$minutes min';
  final h = minutes ~/ 60;
  final m = minutes % 60;
  return m == 0 ? '$h h' : '$h h $m min';
}

class _Tag extends StatelessWidget {
  const _Tag(this.label, {required this.background, required this.foreground});

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(6),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.4,
          color: foreground,
        ),
      ),
    ),
  );
}

/// "LAB" or "LAB · 67_B1", in the lab colours.
class LabTag extends StatelessWidget {
  const LabTag({super.key, required this.section, this.group});

  final String section;
  final String? group;

  @override
  Widget build(BuildContext context) {
    final (container, content) = examColors(context, ExamKind.lab);
    return _Tag(
      group == null ? 'Lab' : 'Lab · ${groupLabel(section, group!)}',
      background: container,
      foreground: content,
    );
  }
}

/// Room and teacher of a class, with the course code when a title leads.
class ClassPlace extends StatelessWidget {
  const ClassPlace(this.c, {super.key, this.color});

  final RoutineClass c;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodyMedium?.copyWith(
      color: color ?? Theme.of(context).colorScheme.onSurfaceVariant,
    );
    Widget item(IconData icon, String text, String label) => Semantics(
      label: '$label $text',
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: 4,
        children: [
          Icon(icon, size: 15, color: style?.color),
          Text(text, style: style),
        ],
      ),
    );
    return Wrap(
      spacing: 12,
      runSpacing: 2,
      children: [
        if (c.course.title != null) Text(c.course.code, style: style),
        item(Icons.place_outlined, c.room, 'Room'),
        if (c.teacher case final t?)
          item(Icons.person_outline_rounded, t.name ?? t.initials, 'Teacher'),
      ],
    );
  }
}

/// One class in a day's list, with "Now" and "Next" on today's.
class ClassTile extends StatelessWidget {
  const ClassTile({
    super.key,
    required this.c,
    required this.section,
    this.state,
    this.isNext = false,
    this.now,
  });

  final RoutineClass c;
  final String section;
  final ClassState? state;
  final bool isNext;
  final DhakaNow? now;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final on = state == ClassState.now;
    final foreground = on ? scheme.onPrimaryContainer : scheme.onSurface;
    final muted = on
        ? scheme.onPrimaryContainer.withValues(alpha: 0.85)
        : scheme.onSurfaceVariant;
    final left = now == null
        ? null
        : on
        ? minutesOf(c.end) - now!.minutes
        : isNext
        ? minutesOf(c.start) - now!.minutes
        : null;
    return Opacity(
      opacity: state == ClassState.over ? 0.55 : 1,
      child: Material(
        color: on ? scheme.primaryContainer : scheme.surfaceContainer,
        // Its details: the room, and the teacher with how to reach them.
        child: InkWell(
          onTap: () => showClassSheet(context, c: c, section: section),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 4,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (on)
                      _Tag(
                        'Now',
                        background: scheme.primary,
                        foreground: scheme.onPrimary,
                      )
                    else if (isNext)
                      _Tag(
                        'Next',
                        background: scheme.surfaceContainerHighest,
                        foreground: scheme.onSurface,
                      ),
                    Text(
                      [
                        timeRange(c.start, c.end),
                        if (left != null)
                          on ? '$left min left' : 'in ${_wait(left)}',
                      ].join(' · '),
                      style: Theme.of(context).textTheme.bodyMedium
                          ?.copyWith(color: muted),
                    ),
                    if (isLab(c)) LabTag(section: section, group: c.labGroup),
                  ],
                ),
                Text(
                  c.course.title ?? c.course.code,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: foreground,
                  ),
                ),
                ClassPlace(c, color: muted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A day's classes as one rounded group, "Now" and "Next" marked when [now] is
/// given (the day is today).
class DayClasses extends StatelessWidget {
  const DayClasses({
    super.key,
    required this.classes,
    required this.section,
    this.now,
  });

  final List<RoutineClass> classes;
  final String section;
  final DhakaNow? now;

  @override
  Widget build(BuildContext context) {
    final next = now == null
        ? -1
        : classes.indexWhere((c) => classState(c, now!) == ClassState.later);
    return RowGroup(
      children: [
        for (final (i, c) in classes.indexed)
          ClassTile(
            c: c,
            section: section,
            state: now == null ? null : classState(c, now!),
            isNext: i == next,
            now: now,
          ),
      ],
    );
  }
}

/// The one thing to know now, as a tile in the space's colour: the class you're
/// in, the next one today, or (after the last, or on a day off) the next class.
class TodayCard extends StatelessWidget {
  const TodayCard({
    super.key,
    required this.classes,
    required this.section,
    required this.now,
  });

  final List<RoutineClass> classes;
  final String section;
  final DhakaNow now;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final on = scheme.onPrimaryContainer;
    final muted = on.withValues(alpha: 0.85);
    final todays = [
      for (final c in classes)
        if (c.day == now.day) c,
    ];
    final current = todays
        .where((c) => classState(c, now) == ClassState.now)
        .firstOrNull;
    final next = nextClass(classes, now);

    String eyebrow;
    String headline;
    RoutineClass? focus;
    String? detail;
    String? after;
    if (current != null) {
      eyebrow = 'In class now · until ${clockTime(current.end)}';
      headline = current.course.title ?? current.course.code;
      focus = current;
      detail = '${minutesOf(current.end) - now.minutes} min left';
      if (next != null && next.daysAhead == 0) {
        after =
            'Next at ${clockTime(next.c.start)}: ${next.c.course.title ?? next.c.course.code}, ${next.c.room}';
      }
    } else if (next != null && next.daysAhead == 0) {
      eyebrow =
          'Next class · in ${_wait(minutesOf(next.c.start) - now.minutes)}';
      headline = next.c.course.title ?? next.c.course.code;
      focus = next.c;
      detail = timeRange(next.c.start, next.c.end);
    } else {
      eyebrow = dayName(now.day);
      headline = todays.isEmpty ? 'No classes today' : 'Done for today';
      if (next != null) {
        after =
            '${dayWord(next.c.day, next.daysAhead)} at ${clockTime(next.c.start)}: ${next.c.course.title ?? next.c.course.code}, ${next.c.room}';
      }
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: ColoredBox(
        color: scheme.primaryContainer,
        child: Stack(
          children: [
            Positioned(
              right: -36,
              bottom: -48,
              child: Transform.rotate(
                angle: 0.2,
                child: ExamShape(
                  ExamKind.midterm,
                  color: scheme.primary.withValues(alpha: 0.15),
                  size: 180,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 20, 22, 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 10,
                children: [
                  Text(
                    eyebrow,
                    style: Theme.of(context).textTheme.labelLarge
                        ?.copyWith(color: muted, fontWeight: FontWeight.w600),
                  ),
                  Text(
                    headline,
                    style: expressive(30, color: on).copyWith(height: 1.08),
                  ),
                  if (focus != null)
                    Wrap(
                      spacing: 10,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        if (detail != null)
                          Text(
                            detail,
                            style: TextStyle(
                              color: on,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        if (isLab(focus))
                          LabTag(section: section, group: focus.labGroup),
                        ClassPlace(focus, color: muted),
                      ],
                    ),
                  if (after != null)
                    Text(
                      after,
                      style: Theme.of(context).textTheme.bodyMedium
                          ?.copyWith(color: muted),
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

/// The week's days as chips with this week's dates; a dot marks days with
/// classes.
class DayStrip extends StatelessWidget {
  const DayStrip({
    super.key,
    required this.days,
    required this.selected,
    required this.today,
    required this.dates,
    required this.hasClasses,
    required this.onSelect,
  });

  final List<RoutineDay> days;
  final RoutineDay selected;
  final RoutineDay? today;
  final Map<RoutineDay, DateTime> dates;
  final bool Function(RoutineDay day) hasClasses;
  final ValueChanged<RoutineDay> onSelect;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      spacing: 6,
      children: [
        for (final day in days)
          Expanded(
            child: Semantics(
              selected: day == selected,
              button: true,
              label:
                  '${dayName(day)}${day == today ? ', today' : ''}${hasClasses(day) ? '' : ', no classes'}',
              excludeSemantics: true,
              child: Material(
                color: day == selected
                    ? scheme.primary
                    : scheme.surfaceContainer,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: day == today && day != selected
                      ? BorderSide(color: scheme.primary, width: 2)
                      : BorderSide.none,
                ),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => onSelect(day),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Column(
                      spacing: 2,
                      children: [
                        Text(
                          shortDayName(day),
                          style: TextStyle(
                            fontSize: 12,
                            color: day == selected
                                ? scheme.onPrimary
                                : scheme.onSurfaceVariant,
                          ),
                        ),
                        Text(
                          '${dates[day]?.day ?? ''}',
                          style: expressive(
                            18,
                            width: 110,
                            weight: 760,
                            color: day == selected
                                ? scheme.onPrimary
                                : scheme.onSurface,
                          ),
                        ),
                        Container(
                          width: 5,
                          height: 5,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: hasClasses(day)
                                ? (day == selected
                                      ? scheme.onPrimary
                                      : scheme.onSurfaceVariant)
                                : Colors.transparent,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// A section's week: the day strip over the chosen day's classes, opening on
/// today.
class SectionWeek extends ConsumerStatefulWidget {
  const SectionWeek({super.key, required this.routine, required this.group});

  final RoutineSection routine;
  final String? group;

  @override
  ConsumerState<SectionWeek> createState() => _SectionWeekState();
}

class _SectionWeekState extends ConsumerState<SectionWeek> {
  RoutineDay? _picked;

  @override
  Widget build(BuildContext context) {
    final now = watchNow(ref);
    final classes = classesFor(widget.routine.classes, widget.group);
    final days = weekDays(classes);
    final today = days.contains(now.day) ? now.day : null;
    final day = _picked ?? today ?? days.first;
    final onDay = [
      for (final c in classes)
        if (c.day == day) c,
    ];
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        DayStrip(
          days: days,
          selected: day,
          today: today,
          dates: weekDates(now),
          hasClasses: (d) => classes.any((c) => c.day == d),
          onSelect: (d) => setState(() => _picked = d),
        ),
        Row(
          children: [
            Expanded(
              child: Text(
                '${dayName(day)}${day == today ? ', today' : ''}',
                style: Theme.of(context).textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            Text(
              onDay.isEmpty ? '' : plural(onDay.length, 'class', 'classes'),
              style: TextStyle(color: scheme.onSurfaceVariant),
            ),
          ],
        ),
        if (onDay.isEmpty)
          DecoratedBox(
            decoration: BoxDecoration(
              color: scheme.surfaceContainer,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
              child: Column(
                spacing: 4,
                children: [
                  Text(
                    'No classes on ${dayName(day)}',
                    style: Theme.of(context).textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    'Enjoy the day off.',
                    style: TextStyle(color: scheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          )
        else
          DayClasses(
            classes: onDay,
            section: widget.routine.section,
            now: day == today ? now : null,
          ),
      ],
    );
  }
}

/// The lab groups as filter chips: the whole section, or one group.
class GroupChips extends StatelessWidget {
  const GroupChips({
    super.key,
    required this.routine,
    required this.group,
    required this.onChanged,
  });

  final RoutineSection routine;
  final String? group;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: Row(
      spacing: 8,
      children: [
        for (final g in [null, ...routine.labGroups])
          ChoiceChip(
            label: Text(
              g == null ? 'Both groups' : groupLabel(routine.section, g),
            ),
            selected: g == group,
            showCheckmark: false,
            onSelected: (_) => onChanged(g),
          ),
      ],
    ),
  );
}

/// The PDF of a section's week: pick the lab group, then share or save it (the
/// share sheet has "Save to Files" and Drive).
Future<void> showRoutinePdfSheet(
  BuildContext context,
  WidgetRef ref, {
  required RoutineSection routine,
  required String? group,
}) => showModalBottomSheet<void>(
  context: context,
  useRootNavigator: true,
  showDragHandle: true,
  builder: (sheet) => Theme(
    data: Theme.of(context),
    child: _PdfSheet(routine: routine, group: group),
  ),
);

class _PdfSheet extends ConsumerStatefulWidget {
  const _PdfSheet({required this.routine, required this.group});

  final RoutineSection routine;
  final String? group;

  @override
  ConsumerState<_PdfSheet> createState() => _PdfSheetState();
}

class _PdfSheetState extends ConsumerState<_PdfSheet> {
  late String? _group = widget.group;
  var _busy = false;

  RoutinePick get _pick => (section: widget.routine.section, group: _group);

  String get _fileName =>
      '${pickLabel(_pick).replaceAll(RegExp(r'[^A-Za-z0-9_.-]+'), '_')}_routine_v${widget.routine.version.version}.pdf';

  Future<void> _share(BuildContext button) async {
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await sharePaper(
        button,
        dio: ref.read(dioProvider),
        url: routinePdfUrl(_pick),
        fileName: _fileName,
      );
      if (mounted) Navigator.of(context).pop();
    } on Object catch (error) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            isOffline(error)
                ? "You're offline. Connect to download the PDF."
                : "Couldn't make the PDF. Try again.",
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final routine = widget.routine;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 12,
          children: [
            Text(
              'Routine PDF',
              style: expressive(26, color: theme.colorScheme.onSurface),
            ),
            Text(
              'One A4 page of ${pickLabel(_pick)}’s week, with the routine’s version (v${routine.version.version}) and a code that opens the latest one.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            if (routine.labGroups.isNotEmpty)
              RadioGroup<String?>(
                groupValue: _group,
                onChanged: (g) => setState(() => _group = g),
                child: Column(
                  children: [
                    for (final g in [...routine.labGroups, null])
                      RadioListTile<String?>(
                        value: g,
                        contentPadding: EdgeInsets.zero,
                        title: Text(
                          g == null
                              ? 'Whole section (${routine.section})'
                              : groupLabel(routine.section, g),
                        ),
                        subtitle: Text(
                          g == null
                              ? 'Both lab groups’ labs'
                              : 'The section’s classes and lab group $g’s labs',
                        ),
                      ),
                  ],
                ),
              ),
            Builder(
              builder: (button) => FilledButton.icon(
                onPressed: _busy ? null : () => unawaited(_share(button)),
                icon: _busy
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.ios_share_rounded),
                label: Text(_busy ? 'Making the PDF…' : 'Save or share'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
