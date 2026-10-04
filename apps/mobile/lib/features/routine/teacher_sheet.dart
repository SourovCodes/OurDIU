import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/generated/export.dart';
import '../../data/routine.dart';
import '../../theme/theme.dart';
import '../../widgets/question_row.dart';

// A class's and a teacher's details in a sheet: where the teacher sits and how to
// reach them, as the department's routine or the site's admins give them.

/// A section's teachers there's more to say about than their initials (the course
/// list has those): a name, the room where they sit, email, phone.
List<RoutineTeacher> teachersWithDetails(List<RoutineClass> classes) => [
  ...{
    for (final t in classes.map((c) => c.teacher).nonNulls) t.initials: t,
  }.values.where(
    (t) =>
        t.name != null || t.room != null || t.email != null || t.phone != null,
  ),
];

/// The courses a teacher teaches among [classes].
List<String> coursesOf(RoutineTeacher t, List<RoutineClass> classes) => {
  for (final c in classes)
    if (c.teacher?.initials == t.initials) c.course.title ?? c.course.code,
}.toList();

/// A class's details: its course, time, room and teacher.
Future<void> showClassSheet(
  BuildContext context, {
  required RoutineClass c,
  required String section,
}) => _sheet(context, _ClassSheet(c: c, section: section));

/// A teacher's details and how to reach them.
Future<void> showTeacherSheet(
  BuildContext context, {
  required RoutineTeacher teacher,
  required List<String> courses,
}) => _sheet(context, _TeacherSheet(teacher: teacher, courses: courses));

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
  const _ClassSheet({required this.c, required this.section});

  final RoutineClass c;
  final String section;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    final teacher = c.teacher;
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
                    ? 'Teacher'
                    : 'Teacher · ${teacher.initials}',
              ),
          ],
        ),
        if (teacher != null) _Contact(teacher),
      ],
    );
  }
}

class _TeacherSheet extends StatelessWidget {
  const _TeacherSheet({required this.teacher, required this.courses});

  final RoutineTeacher teacher;
  final List<String> courses;

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
        _Contact(teacher, showEmpty: true),
      ],
    );
  }
}

/// Where a teacher sits, their email and phone: each opens its app, a long press
/// copies it.
class _Contact extends StatelessWidget {
  const _Contact(this.t, {this.showEmpty = false});

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
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? copy;
  final Uri? open;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainer,
      child: ListTile(
        leading: Icon(icon, color: scheme.onSurfaceVariant),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: open == null
            ? null
            : Icon(Icons.open_in_new_rounded, size: 18, color: scheme.primary),
        onTap: open == null
            ? null
            : () => launchUrl(open!, mode: LaunchMode.externalApplication),
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
