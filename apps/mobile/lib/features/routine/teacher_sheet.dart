import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/generated/export.dart';
import '../../data/routine.dart';
import '../../theme/theme.dart';
import '../../widgets/question_row.dart';

// A class's and a teacher's details in a sheet: where the teacher sits and how to
// reach them, as the department's routine or the site's admins give them, and the
// way to their week (or, for a teacher's class, to the sections attending).

/// Where a section's week opens in the app.
String sectionLocation(RoutinePick pick) => Uri(
  path:
      '/routine/sections/${pick.department.json}/${Uri.encodeComponent(pick.section)}',
  queryParameters: pick.group == null ? null : {'group': pick.group},
).toString();

/// Where a teacher's week opens in the app.
String teacherLocation(TeacherPick pick) =>
    '/routine/teachers/${pick.department.json}/${Uri.encodeComponent(pick.initials)}';

/// The courses a teacher teaches among [classes].
List<String> coursesOf(RoutineTeacher t, List<RoutineClass> classes) => {
  for (final c in classes)
    if (c.teacher?.initials == t.initials) c.course.title ?? c.course.code,
}.toList();

/// A class's details: its course, time, room and teacher (or, in a teacher's
/// week, the sections attending).
Future<void> showClassSheet(
  BuildContext context, {
  required RoutineClass c,
  required String section,
  required RoutineDepartmentSlug department,
}) => _sheet(
  context,
  _ClassSheet(
    c: c,
    section: section,
    department: department,
    go: (location) => _goFrom(context, location),
  ),
);

/// A teacher's details, how to reach them and the way to their week.
Future<void> showTeacherSheet(
  BuildContext context, {
  required RoutineTeacher teacher,
  required List<String> courses,
  required RoutineDepartmentSlug department,
}) => _sheet(
  context,
  _TeacherSheet(
    teacher: teacher,
    courses: courses,
    department: department,
    go: (location) => _goFrom(context, location),
  ),
);

/// Closes the sheet, then opens [location] from the screen it covered.
void _goFrom(BuildContext context, String location) {
  Navigator.of(context, rootNavigator: true).pop();
  context.go(location);
}

Future<void> _sheet(BuildContext context, Widget child) =>
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheet) => Theme(
        data: Theme.of(context),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
            child: child,
          ),
        ),
      ),
    );

class _ClassSheet extends StatelessWidget {
  const _ClassSheet({
    required this.c,
    required this.section,
    required this.department,
    required this.go,
  });

  final RoutineClass c;
  final String section;
  final RoutineDepartmentSlug department;
  final ValueChanged<String> go;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    final teacher = c.teacher;
    final attending = c is AttendedClass ? (c as AttendedClass).sections : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        Text(
          c.course.title ?? c.course.code,
          style: expressive(26, color: theme.colorScheme.onSurface),
        ),
        Text(
          [
            if (c.course.title != null) c.course.code,
            '${dayName(c.day)}, ${timeRange(c.start, c.end)}',
            if (isLab(c))
              c.labGroup == null
                  ? 'Lab'
                  : 'Lab · ${groupLabel(section, c.labGroup!)}',
          ].join(' · '),
          style: theme.textTheme.bodyMedium?.copyWith(color: muted),
        ),
        RowGroup(
          children: [
            _Detail(
              icon: Icons.place_outlined,
              title: c.room,
              subtitle: 'Room',
            ),
            if (teacher != null)
              _Detail(
                icon: Icons.person_outline_rounded,
                title: teacher.name ?? teacher.initials,
                subtitle: teacher.name == null
                    ? 'Teacher · their week'
                    : 'Teacher · ${teacher.initials} · their week',
                onTap: () => go(
                  teacherLocation((
                    department: department,
                    initials: teacher.initials,
                  )),
                ),
              ),
            for (final s in attending ?? const <RoutineAttendingSection>[])
              _Detail(
                icon: Icons.groups_outlined,
                title: pickLabel(s.section, s.labGroup),
                subtitle: 'Section · its week',
                onTap: () => go(
                  sectionLocation((
                    department: department,
                    section: s.section,
                    group: s.labGroup,
                  )),
                ),
              ),
          ],
        ),
        if (teacher != null) TeacherContact(teacher),
      ],
    );
  }
}

class _TeacherSheet extends StatelessWidget {
  const _TeacherSheet({
    required this.teacher,
    required this.courses,
    required this.department,
    required this.go,
  });

  final RoutineTeacher teacher;
  final List<String> courses;
  final RoutineDepartmentSlug department;
  final ValueChanged<String> go;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        Text(
          teacher.name ?? teacher.initials,
          style: expressive(26, color: theme.colorScheme.onSurface),
        ),
        Text(
          [
            if (teacher.name != null) teacher.initials,
            if (courses.isNotEmpty) courses.join(', '),
          ].join(' · '),
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        TeacherContact(teacher, showEmpty: true),
        FilledButton.icon(
          onPressed: () => go(
            teacherLocation((
              department: department,
              initials: teacher.initials,
            )),
          ),
          icon: const Icon(Icons.calendar_view_week_rounded),
          label: const Text('See their week'),
        ),
      ],
    );
  }
}

/// Where a teacher sits, their email and phone: each opens its app, a long press
/// copies it.
class TeacherContact extends StatelessWidget {
  const TeacherContact(this.t, {super.key, this.showEmpty = false});

  final RoutineTeacher t;
  final bool showEmpty;

  @override
  Widget build(BuildContext context) {
    final rows = [
      if (t.room case final room?)
        _Detail(
          icon: Icons.meeting_room_outlined,
          title: room,
          subtitle: 'Sits in',
          copy: room,
        ),
      if (t.email case final email?)
        _Detail(
          icon: Icons.mail_outline_rounded,
          title: email,
          subtitle: 'Email',
          copy: email,
          open: Uri(scheme: 'mailto', path: email),
        ),
      if (t.phone case final phone?)
        _Detail(
          icon: Icons.call_outlined,
          title: phone,
          subtitle: 'Phone',
          copy: phone,
          open: Uri(
            scheme: 'tel',
            path: phone.replaceAll(RegExp(r'[\s-]'), ''),
          ),
        ),
    ];
    if (rows.isEmpty) {
      return showEmpty
          ? Text(
              'No room, email or phone yet.',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            )
          : const SizedBox.shrink();
    }
    return RowGroup(children: rows);
  }
}

class _Detail extends StatelessWidget {
  const _Detail({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.copy,
    this.open,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? copy;
  final Uri? open;

  /// Leads somewhere in the app instead of opening another app.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainer,
      child: ListTile(
        leading: Icon(icon, color: scheme.onSurfaceVariant),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: onTap != null
            ? Icon(Icons.chevron_right_rounded, color: scheme.primary)
            : open == null
            ? null
            : Icon(Icons.open_in_new_rounded, size: 18, color: scheme.primary),
        onTap:
            onTap ??
            (open == null
                ? null
                : () => launchUrl(open!, mode: LaunchMode.externalApplication)),
        onLongPress: copy == null
            ? null
            : () {
                Clipboard.setData(ClipboardData(text: copy!));
                ScaffoldMessenger.of(context)
                    .showSnackBar(SnackBar(content: Text('Copied $copy')));
              },
      ),
    );
  }
}
