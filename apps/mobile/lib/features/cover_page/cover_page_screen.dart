import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/generated/export.dart';
import '../../auth/sign_in_flow.dart';
import '../../auth/token.dart';
import '../../data/cover_page.dart';
import '../../data/prefs.dart';
import '../../data/routine.dart';
import '../../spaces/space.dart';
import '../../spaces/switcher.dart';
import '../../theme/theme.dart';

/// What the preview makes the page from.
typedef CoverPreview = ({CoverPageTemplate template, CoverPageInput input});

/// The Cover Page space: one screen, the maker (docs/PLAN.md, decision 39). It
/// asks what the page is for, which course and the topic; the teacher and the
/// student come from the routine and the account. Then the page is previewed and
/// shared.
class CoverPageScreen extends ConsumerWidget {
  const CoverPageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Signing in here starts it again: the maker stays, and fills its blanks.
    final start = ref.watch(coverStartProvider).value;
    return Theme(
      data: Space.cover.theme(context),
      child: start == null
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : _Maker(start: start),
    );
  }
}

class _Maker extends ConsumerStatefulWidget {
  const _Maker({required this.start});

  final CoverStart start;

  @override
  ConsumerState<_Maker> createState() => _MakerState();
}

class _MakerState extends ConsumerState<_Maker> {
  var _template = CoverPageTemplate.assignment;
  late final _fields = {
    for (final f in CoverField.values)
      f: TextEditingController(text: widget.start.values[f] ?? ''),
  };
  late final List<_MemberFields> _members = [
    // The student first, as on the website.
    _MemberFields(
      name: widget.start.values[CoverField.studentName] ?? '',
      id: widget.start.values[CoverField.studentId] ?? '',
    ),
  ];

  /// The lab report index's experiments, numbered from 1.
  late final List<_ExperimentFields> _experiments = [
    _ExperimentFields(no: '1'),
  ];

  /// The section whose courses are offered, and its courses.
  late CoverSection? _section = widget.start.section;
  late List<CoverCourse> _courses = widget.start.courses;

  /// The course picked from the section's, or another one being typed.
  CoverCourse? _course;
  var _other = false;
  var _loadingSection = false;

  @override
  void initState() {
    super.initState();
    for (final c in [
      ..._fields.values,
      for (final m in _members) ...m.both,
      for (final e in _experiments) ...e.all,
    ]) {
      c.addListener(_changed);
    }
  }

  void _changed() => setState(() {});

  @override
  void didUpdateWidget(_Maker old) {
    super.didUpdateWidget(old);
    // Signed in since: the account fills what's still blank.
    for (final f in rememberedFields) {
      final v = widget.start.values[f] ?? '';
      if (_fields[f]!.text.trim().isEmpty && v.isNotEmpty) _fields[f]!.text = v;
    }
    final me = _members.first;
    if (me.name.text.trim().isEmpty) {
      me.name.text = widget.start.values[CoverField.studentName] ?? '';
    }
    if (me.id.text.trim().isEmpty) {
      me.id.text = widget.start.values[CoverField.studentId] ?? '';
    }
    if (_courses.isEmpty && widget.start.courses.isNotEmpty) {
      _section = widget.start.section;
      _courses = widget.start.courses;
    }
  }

  @override
  void dispose() {
    for (final c in _fields.values) {
      c.dispose();
    }
    for (final m in _members) {
      m.dispose();
    }
    for (final e in _experiments) {
      e.dispose();
    }
    super.dispose();
  }

  String _value(CoverField f) => _fields[f]!.text;
  bool _filled(List<CoverField> fields) =>
      fields.every((f) => _value(f).trim().isNotEmpty);

  void _set(CoverField f, String v) => _fields[f]!.text = v;

  void _pickCourse(CoverCourse? c) {
    setState(() {
      _course = c;
      _other = c == null;
    });
    _set(CoverField.courseCode, c?.code ?? '');
    _set(CoverField.courseTitle, c?.title ?? '');
    _set(CoverField.teacherName, c?.teacherName ?? '');
    _set(CoverField.teacherDesignation, c?.teacherDesignation ?? '');
    _set(CoverField.teacherDepartment, c?.teacherDepartment ?? '');
  }

  /// Back to the section's list of courses.
  void _changeCourse() => setState(() {
    _course = null;
    _other = false;
  });

  Future<void> _chooseSection() async {
    final picked = await showModalBottomSheet<CoverSection>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => Theme(
        data: Space.cover.theme(context),
        child: _SectionSheet(current: _section),
      ),
    );
    if (picked == null || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _loadingSection = true);
    try {
      final courses = await sectionCourses(
        ref.read(
          routineSectionProvider((
            department: picked.department,
            section: picked.section,
          )).future,
        ),
        picked,
        widget.start.names,
      );
      if (!mounted) return;
      setState(() {
        _section = picked;
        _courses = courses;
        _course = null;
        _other = false;
      });
      _set(CoverField.section, picked.section);
      if (_value(CoverField.studentDepartment).trim().isEmpty) {
        _set(
          CoverField.studentDepartment,
          departmentLabel(
            departmentName(picked.department),
            widget.start.names,
          ),
        );
      }
      rememberSection(ref.read(prefsProvider), picked).ignore();
    } on Object {
      messenger.showSnackBar(
        const SnackBar(
          content: Text("Couldn't load that section's courses. Try again."),
        ),
      );
    } finally {
      if (mounted) setState(() => _loadingSection = false);
    }
  }

  DateTime? _date() {
    final p = _value(CoverField.date).split('/').map(int.tryParse).toList();
    return p.length == 3 && !p.contains(null)
        ? DateTime.utc(p[2]!, p[1]!, p[0]!)
        : null;
  }

  Future<void> _pickDate() async {
    final now = ref.read(coverPageClockProvider)();
    final shown = _date() ?? now;
    final picked = await showDatePicker(
      context: context,
      initialDate: shown,
      firstDate: DateTime(shown.year - 1),
      lastDate: DateTime(shown.year + 1, 12, 31),
    );
    if (picked == null) return;
    // Noon in Dhaka is the day picked.
    _set(
      CoverField.date,
      dhakaDate(DateTime.utc(picked.year, picked.month, picked.day, 6)),
    );
  }

  void _preview() {
    final values = {for (final f in CoverField.values) f: _value(f)};
    rememberDetails(ref.read(prefsProvider), values).ignore();
    context.push(
      '/cover-page/preview',
      extra: (
        template: _template,
        input: coverPageInput(
          _template,
          values,
          members: [for (final m in _members) m.value],
          experiments: [for (final e in _experiments) e.value],
        ),
      ),
    );
  }

  /// "Today, 6 October 2026", "Tomorrow, …" or "Wednesday, 14 October 2026".
  String _dateLabel() {
    final d = _date();
    if (d == null) return _value(CoverField.date);
    final now = ref.read(coverPageClockProvider)();
    final day = switch (_value(CoverField.date)) {
      final v when v == dhakaDate(now) => 'Today',
      final v when v == dhakaDate(now.add(const Duration(days: 1))) =>
        'Tomorrow',
      _ => _weekdays[d.weekday - 1],
    };
    return '$day, ${d.day} ${_months[d.month - 1]} ${d.year}';
  }

  void _addMember() {
    final m = _MemberFields();
    for (final c in m.both) {
      c.addListener(_changed);
    }
    setState(() => _members.add(m));
  }

  void _removeMember(_MemberFields m) {
    setState(() => _members.remove(m));
    m.dispose();
  }

  void _addExperiment() {
    final e = _ExperimentFields(no: '${_experiments.length + 1}');
    for (final c in e.all) {
      c.addListener(_changed);
    }
    setState(() => _experiments.add(e));
  }

  void _removeExperiment(_ExperimentFields e) {
    setState(() => _experiments.remove(e));
    e.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final group = isGroupTemplate(_template);
    final work = workFields(_template);
    final titlePage = isTitlePage(_template);
    final index = isIndex(_template);
    final fields = templateFields(_template);
    bool has(CoverField f) => fields.contains(f);
    final teacher = [
      CoverField.teacherName,
      CoverField.teacherDesignation,
      CoverField.teacherDepartment,
    ].where(has).toList();
    // The routine knows only the teacher's initials: their name is asked for.
    final initialsOnly =
        _course != null &&
            _course!.teacherName.isEmpty &&
            _course!.teacherInitials.isNotEmpty
        ? _course!.teacherInitials
        : null;
    // Until a course is picked from the list, the teacher waits for it.
    final chosen = titlePage || _course != null || _other || _courses.isEmpty;
    final signedOut = ref.watch(sessionTokenProvider) == null;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            const SpaceTitle(Space.cover),
            const SizedBox(height: 12),
            Text(
              'What’s it for?',
              style: expressive(36, color: scheme.onSurface),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final t in coverTemplates)
                  ChoiceChip(
                    label: Text(coverTemplateName(t)),
                    selected: t == _template,
                    onSelected: (_) => setState(() => _template = t),
                  ),
              ],
            ),
            if (!titlePage) ...[
              const SizedBox(height: 24),
              Row(
                children: [
                  const Expanded(child: _Question('Which course?')),
                  if (_section case final s? when _courses.isNotEmpty)
                    TextButton(
                      onPressed: _loadingSection ? null : _chooseSection,
                      child: Text('${s.section} · Change'),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              if (_courses.isEmpty)
                _NoSection(
                  loading: _loadingSection,
                  onChoose: _chooseSection,
                  code: _fields[CoverField.courseCode]!,
                  title: _fields[CoverField.courseTitle]!,
                )
              else if (_course case final c?)
                _PickedCourse(course: c, onChange: _changeCourse)
              else if (_other)
                _Card(
                  children: [
                    _CourseFields(
                      code: _fields[CoverField.courseCode]!,
                      title: _fields[CoverField.courseTitle]!,
                    ),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: _changeCourse,
                        child: Text('Pick from ${_section?.section}’s courses'),
                      ),
                    ),
                  ],
                )
              else
                _CourseList(
                  courses: _courses,
                  onPick: _pickCourse,
                  onOther: () => _pickCourse(null),
                ),
            ],
            if (work.isNotEmpty) ...[
              const SizedBox(height: 24),
              _Question(switch (_template) {
                CoverPageTemplate.labReport => 'Which experiment?',
                CoverPageTemplate.projectReport => 'What’s the project?',
                _ when titlePage => 'What’s the title?',
                _ => 'What’s the topic?',
              }),
              const SizedBox(height: 10),
              if (_template == CoverPageTemplate.labReport)
                Row(
                  spacing: 10,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 96,
                      child: _Field(
                        _fields[CoverField.experimentNo]!,
                        CoverField.experimentNo,
                        keyboard: TextInputType.number,
                        label: 'No.',
                      ),
                    ),
                    Expanded(
                      child: _Field(
                        _fields[CoverField.experimentName]!,
                        CoverField.experimentName,
                        highlight: _value(CoverField.experimentName)
                            .trim()
                            .isEmpty,
                        lines: 3,
                      ),
                    ),
                  ],
                )
              else
                _Field(
                  _fields[CoverField.topic]!,
                  CoverField.topic,
                  label: 'Topic',
                  hint: titlePage
                      ? 'The report’s title'
                      : _template == CoverPageTemplate.projectReport
                      ? 'Your project’s title'
                      : null,
                  floating: false,
                  highlight: _value(CoverField.topic).trim().isEmpty,
                  lines: 4,
                ),
            ],
            if (index) ...[
              const SizedBox(height: 24),
              const _Question('Experiments'),
              const SizedBox(height: 4),
              Text(
                'The rest of the $maxCoverExperiments rows print blank, to '
                'write in.',
                style: TextStyle(color: scheme.onSurfaceVariant),
              ),
              const SizedBox(height: 10),
              _Experiments(
                experiments: _experiments,
                onAdd: _experiments.length < maxCoverExperiments
                    ? _addExperiment
                    : null,
                onRemove: _experiments.length > 1 ? _removeExperiment : null,
              ),
            ],
            const SizedBox(height: 24),
            _Group(
              // Picking a course can leave it blank: it opens again.
              key: ValueKey((
                'to',
                _template,
                _course?.code,
                _other,
                _courses.isEmpty,
              )),
              title: titlePage
                  ? 'Supervised by'
                  : index
                  ? 'Course teacher'
                  : 'Submitted to',
              summary: _value(CoverField.teacherName),
              startOpen: chosen && (!_filled(teacher) || initialsOnly != null),
              children: [
                _Field(
                  _fields[CoverField.teacherName]!,
                  CoverField.teacherName,
                  label: titlePage ? 'Supervisor' : null,
                  highlight:
                      initialsOnly != null &&
                      _value(CoverField.teacherName).trim().isEmpty,
                  helper: initialsOnly == null
                      ? null
                      : 'The routine only has their initials, $initialsOnly.',
                  words: true,
                ),
                if (has(CoverField.teacherDesignation))
                  _Field(
                    _fields[CoverField.teacherDesignation]!,
                    CoverField.teacherDesignation,
                    words: true,
                  ),
                if (has(CoverField.teacherDepartment))
                  _Field(
                    _fields[CoverField.teacherDepartment]!,
                    CoverField.teacherDepartment,
                  ),
              ],
            ),
            const SizedBox(height: 12),
            _Group(
              key: ValueKey(('by', _template)),
              title: 'Submitted by',
              summary: group
                  ? '${_members.where((m) => m.value.name.trim().isNotEmpty).length} members'
                  : [
                      _value(CoverField.studentName),
                      _value(CoverField.studentId),
                    ].where((s) => s.trim().isNotEmpty).join(', '),
              startOpen:
                  group ||
                  !_filled(
                    const [
                      CoverField.studentName,
                      CoverField.studentId,
                      CoverField.section,
                      CoverField.studentDepartment,
                      CoverField.degree,
                    ].where(has).toList(),
                  ),
              children: [
                if (signedOut &&
                    (_value(CoverField.studentName).trim().isEmpty ||
                        _value(CoverField.studentId).trim().isEmpty))
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                    ),
                    onPressed: () => runSignIn(context, ref),
                    icon: const Icon(Icons.person_outline_rounded),
                    label: const Text('Sign in to fill in your name and ID'),
                  ),
                if (group)
                  _Members(
                    members: _members,
                    onAdd: _members.length < maxCoverMembers
                        ? _addMember
                        : null,
                    onRemove: _members.length > 1 ? _removeMember : null,
                  )
                else ...[
                  _Field(
                    _fields[CoverField.studentName]!,
                    CoverField.studentName,
                    words: true,
                  ),
                  _Field(
                    _fields[CoverField.studentId]!,
                    CoverField.studentId,
                    keyboard: TextInputType.visiblePassword,
                  ),
                ],
                if (has(CoverField.section))
                  Row(
                    spacing: 10,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: _Field(
                          _fields[CoverField.section]!,
                          CoverField.section,
                          caps: true,
                        ),
                      ),
                      Expanded(
                        child: _Field(
                          _fields[CoverField.semester]!,
                          CoverField.semester,
                          words: true,
                        ),
                      ),
                    ],
                  ),
                if (has(CoverField.studentDepartment))
                  _Field(
                    _fields[CoverField.studentDepartment]!,
                    CoverField.studentDepartment,
                  ),
                if (has(CoverField.degree))
                  _Field(
                    _fields[CoverField.degree]!,
                    CoverField.degree,
                    lines: 2,
                  ),
              ],
            ),
            if (has(CoverField.date)) ...[
              const SizedBox(height: 12),
              _DateRow(label: _dateLabel(), onTap: _pickDate),
            ],
            if (has(CoverField.monthYear)) ...[
              const SizedBox(height: 12),
              _Card(
                children: [
                  _Field(
                    _fields[CoverField.monthYear]!,
                    CoverField.monthYear,
                    words: true,
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(
          color: scheme.surface,
          border: Border(top: BorderSide(color: scheme.outlineVariant)),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
              ),
              onPressed: _preview,
              icon: const Icon(Icons.visibility_outlined),
              label: const Text('Preview'),
            ),
          ),
        ),
      ),
    );
  }
}

const _weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
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

/// A group member's name and ID boxes.
class _MemberFields {
  _MemberFields({String name = '', String id = ''})
    : name = TextEditingController(text: name),
      id = TextEditingController(text: id);

  final TextEditingController name;
  final TextEditingController id;

  List<TextEditingController> get both => [name, id];
  CoverMember get value => (name: name.text, id: id.text);

  void dispose() {
    name.dispose();
    id.dispose();
  }
}

/// An experiment's boxes on the lab report index.
class _ExperimentFields {
  _ExperimentFields({String no = ''})
    : no = TextEditingController(text: no),
      name = TextEditingController(),
      performedOn = TextEditingController(),
      submittedOn = TextEditingController();

  final TextEditingController no;
  final TextEditingController name;
  final TextEditingController performedOn;
  final TextEditingController submittedOn;

  List<TextEditingController> get all => [no, name, performedOn, submittedOn];
  CoverExperiment get value => (
    no: no.text,
    name: name.text,
    performedOn: performedOn.text,
    submittedOn: submittedOn.text,
  );

  void dispose() {
    for (final c in all) {
      c.dispose();
    }
  }
}

/// The index's experiments, a card each: no. and name, then its two dates.
class _Experiments extends StatelessWidget {
  const _Experiments({
    required this.experiments,
    required this.onAdd,
    required this.onRemove,
  });

  final List<_ExperimentFields> experiments;
  final VoidCallback? onAdd;
  final void Function(_ExperimentFields)? onRemove;

  @override
  Widget build(BuildContext context) {
    InputDecoration box(String label) => InputDecoration(
      labelText: label,
      counterText: '',
      border: const OutlineInputBorder(),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        for (final (i, e) in experiments.indexed)
          _Card(
            key: ObjectKey(e),
            children: [
              Row(
                spacing: 8,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 72,
                    child: TextField(
                      controller: e.no,
                      maxLength: 10,
                      decoration: box('No.'),
                    ),
                  ),
                  Expanded(
                    child: TextField(
                      controller: e.name,
                      maxLength: 160,
                      minLines: 1,
                      maxLines: 3,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: box('Experiment ${i + 1}'),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Remove experiment ${i + 1}',
                    onPressed: onRemove == null ? null : () => onRemove!(e),
                    icon: const Icon(Icons.remove_circle_outline),
                  ),
                ],
              ),
              Row(
                spacing: 8,
                children: [
                  Expanded(
                    child: TextField(
                      controller: e.performedOn,
                      maxLength: 20,
                      keyboardType: TextInputType.datetime,
                      decoration: box('Done on'),
                    ),
                  ),
                  Expanded(
                    child: TextField(
                      controller: e.submittedOn,
                      maxLength: 20,
                      keyboardType: TextInputType.datetime,
                      decoration: box('Submitted on'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        if (onAdd != null)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Add an experiment'),
            ),
          ),
      ],
    );
  }
}

/// One of the maker's questions.
class _Question extends StatelessWidget {
  const _Question(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Semantics(
    header: true,
    child: Text(
      text,
      style: expressive(
        24,
        width: 120,
        color: Theme.of(context).colorScheme.onSurface,
      ),
    ),
  );
}

/// A tonal card.
class _Card extends StatelessWidget {
  const _Card({super.key, required this.children, this.padding});

  final List<Widget> children;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) => Material(
    color: Theme.of(context).colorScheme.surfaceContainer,
    borderRadius: BorderRadius.circular(24),
    clipBehavior: Clip.antiAlias,
    child: Padding(
      padding: padding ?? const EdgeInsets.fromLTRB(16, 18, 16, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 14,
        children: children,
      ),
    ),
  );
}

/// The section's courses: title, code and who takes it.
class _CourseList extends StatelessWidget {
  const _CourseList({
    required this.courses,
    required this.onPick,
    required this.onOther,
  });

  final List<CoverCourse> courses;
  final void Function(CoverCourse) onPick;
  final VoidCallback onOther;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return _Card(
      padding: EdgeInsets.zero,
      children: [
        Column(
          children: [
            for (final c in courses) ...[
              ListTile(
                contentPadding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                leading: Icon(
                  Icons.radio_button_unchecked_rounded,
                  color: scheme.outline,
                ),
                title: Text(
                  c.title.isEmpty ? c.code : c.title,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: Text(
                  [
                    if (c.title.isNotEmpty) c.code,
                    if (c.teacherName.isNotEmpty)
                      c.teacherName
                    else if (c.teacherInitials.isNotEmpty)
                      c.teacherInitials,
                  ].join(' · '),
                ),
                onTap: () => onPick(c),
              ),
              Divider(height: 1, color: scheme.surfaceContainerHighest),
            ],
            ListTile(
              contentPadding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
              leading: Icon(Icons.add_rounded, color: scheme.primary),
              title: Text(
                'Another course',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: scheme.primary,
                ),
              ),
              onTap: onOther,
            ),
          ],
        ),
      ],
    );
  }
}

/// The course picked, with a way back to the list.
class _PickedCourse extends StatelessWidget {
  const _PickedCourse({required this.course, required this.onChange});

  final CoverCourse course;
  final VoidCallback onChange;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.primaryContainer,
      borderRadius: BorderRadius.circular(24),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
        child: Row(
          spacing: 12,
          children: [
            Icon(Icons.check_circle_rounded, color: scheme.primary),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    course.title.isEmpty ? course.code : course.title,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: scheme.onPrimaryContainer,
                    ),
                  ),
                  if (course.title.isNotEmpty)
                    Text(
                      course.code,
                      style: TextStyle(color: scheme.onPrimaryContainer),
                    ),
                ],
              ),
            ),
            TextButton(onPressed: onChange, child: const Text('Change')),
          ],
        ),
      ),
    );
  }
}

/// No section to take courses from: choose one, or type the course.
class _NoSection extends StatelessWidget {
  const _NoSection({
    required this.loading,
    required this.onChoose,
    required this.code,
    required this.title,
  });

  final bool loading;
  final VoidCallback onChoose;
  final TextEditingController code;
  final TextEditingController title;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return _Card(
      children: [
        Row(
          spacing: 12,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.calendar_month_outlined, color: scheme.primary),
            Expanded(
              child: Text(
                'Pick your section and its courses, titles and teachers fill '
                'themselves in.',
                style: theme.textTheme.bodyLarge,
              ),
            ),
          ],
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: FilledButton.tonal(
            onPressed: loading ? null : onChoose,
            child: loading
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Choose your section'),
          ),
        ),
        Row(
          spacing: 10,
          children: [
            const Expanded(child: Divider()),
            Text(
              'or type it',
              style: theme.textTheme.bodySmall?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
            const Expanded(child: Divider()),
          ],
        ),
        _CourseFields(code: code, title: title),
      ],
    );
  }
}

class _CourseFields extends StatelessWidget {
  const _CourseFields({required this.code, required this.title});

  final TextEditingController code;
  final TextEditingController title;

  @override
  Widget build(BuildContext context) => Row(
    spacing: 10,
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SizedBox(
        width: 140,
        child: _Field(code, CoverField.courseCode, caps: true),
      ),
      Expanded(child: _Field(title, CoverField.courseTitle, words: true)),
    ],
  );
}

/// A group of fields that folds to one line once it's filled in.
class _Group extends StatefulWidget {
  const _Group({
    super.key,
    required this.title,
    required this.summary,
    required this.startOpen,
    required this.children,
  });

  final String title;

  /// What the folded line shows, e.g. the teacher's name.
  final String summary;
  final bool startOpen;
  final List<Widget> children;

  @override
  State<_Group> createState() => _GroupState();
}

class _GroupState extends State<_Group> {
  late var _open = widget.startOpen;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final header = Semantics(
      button: true,
      expanded: _open,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => setState(() => _open = !_open),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            spacing: 8,
            children: [
              Expanded(
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: widget.title,
                        style: expressive(
                          18,
                          width: 115,
                          color: scheme.onSurface,
                        ),
                      ),
                      if (!_open && widget.summary.trim().isNotEmpty)
                        TextSpan(
                          text: ' · ${widget.summary}',
                          style: theme.textTheme.bodyLarge?.copyWith(
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                    ],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Icon(
                _open
                    ? Icons.keyboard_arrow_up_rounded
                    : Icons.keyboard_arrow_down_rounded,
              ),
            ],
          ),
        ),
      ),
    );
    return _Card(children: [header, if (_open) ...widget.children]);
  }
}

/// A labelled text box for one field.
class _Field extends StatelessWidget {
  const _Field(
    this.controller,
    this.field, {
    this.highlight = false,
    this.caps = false,
    this.words = false,
    this.label,
    this.floating = true,
    this.lines = 1,
    this.keyboard,
    this.helper,
    this.hint,
  });

  final TextEditingController controller;
  final CoverField field;
  final bool highlight;
  final bool caps;
  final bool words;

  /// The field's own label unless given.
  final String? label;

  /// False when a question above already names it: the label stays inside.
  final bool floating;
  final int lines;
  final TextInputType? keyboard;
  final String? helper;

  /// In place of the field's own hint.
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return TextField(
      controller: controller,
      maxLength: field.maxLength,
      minLines: lines > 1 ? 2 : 1,
      maxLines: lines,
      keyboardType: lines > 1 ? TextInputType.multiline : keyboard,
      textCapitalization: caps
          ? TextCapitalization.characters
          : words
          ? TextCapitalization.words
          : TextCapitalization.sentences,
      decoration: InputDecoration(
        labelText: floating ? (label ?? field.label) : null,
        hintText: hint ?? (floating ? field.hint : field.hint ?? label),
        helperText: helper,
        helperMaxLines: 2,
        counterText: '',
        border: const OutlineInputBorder(),
        enabledBorder: highlight
            ? OutlineInputBorder(
                borderSide: BorderSide(color: scheme.primary, width: 2),
              )
            : null,
      ),
    );
  }
}

/// The date of submission, picked from a calendar.
class _DateRow extends StatelessWidget {
  const _DateRow({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Material(
      color: scheme.surfaceContainer,
      borderRadius: BorderRadius.circular(24),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Row(
            spacing: 12,
            children: [
              Icon(Icons.event_outlined, color: scheme.primary),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      CoverField.date.label,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                    Text(
                      label,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                'Change',
                style: TextStyle(
                  color: scheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A group's members, up to six: the student first.
class _Members extends StatelessWidget {
  const _Members({
    required this.members,
    required this.onAdd,
    required this.onRemove,
  });

  final List<_MemberFields> members;
  final VoidCallback? onAdd;
  final void Function(_MemberFields)? onRemove;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    spacing: 10,
    children: [
      for (final (i, m) in members.indexed)
        Row(
          key: ObjectKey(m),
          spacing: 8,
          children: [
            Expanded(
              flex: 3,
              child: TextField(
                controller: m.name,
                maxLength: maxMemberName,
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(
                  labelText: i == 0 ? 'You' : 'Member ${i + 1}',
                  counterText: '',
                  border: const OutlineInputBorder(),
                ),
              ),
            ),
            Expanded(
              flex: 2,
              child: TextField(
                controller: m.id,
                maxLength: maxMemberId,
                keyboardType: TextInputType.visiblePassword,
                decoration: const InputDecoration(
                  labelText: 'ID',
                  counterText: '',
                  border: OutlineInputBorder(),
                ),
              ),
            ),
            IconButton(
              tooltip: 'Remove member ${i + 1}',
              onPressed: onRemove == null ? null : () => onRemove!(m),
              icon: const Icon(Icons.remove_circle_outline),
            ),
          ],
        ),
      if (onAdd != null)
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.person_add_alt_outlined),
            label: const Text('Add a member'),
          ),
        ),
    ],
  );
}

/// Every section in the live routines, to take courses from. Picking one here
/// doesn't make it the Class Routine's "My section".
class _SectionSheet extends ConsumerStatefulWidget {
  const _SectionSheet({required this.current});

  final CoverSection? current;

  @override
  ConsumerState<_SectionSheet> createState() => _SectionSheetState();
}

class _SectionSheetState extends ConsumerState<_SectionSheet> {
  final _query = TextEditingController();
  late RoutineDepartmentSlug? _department = widget.current?.department;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final live = ref.watch(liveDepartmentsProvider).value ?? routineDepartments;
    final department = _department ?? live.firstOrNull;
    final sections = department == null
        ? null
        : ref.watch(routineSectionsProvider(department));
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.8,
        child: Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            bottom: MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 12,
            children: [
              Text(
                'Your section',
                style: expressive(24, color: scheme.onSurface),
              ),
              Wrap(
                spacing: 8,
                children: [
                  for (final d in live)
                    ChoiceChip(
                      label: Text(departmentName(d)),
                      selected: d == department,
                      onSelected: (_) => setState(() => _department = d),
                    ),
                ],
              ),
              SearchBar(
                controller: _query,
                hintText: switch (department) {
                  RoutineDepartmentSlug.eee => 'e.g. 1-2 B',
                  RoutineDepartmentSlug.swe => 'e.g. 44_G',
                  _ => 'e.g. 67_B',
                },
                leading: const Icon(Icons.search_rounded),
                textCapitalization: TextCapitalization.characters,
                elevation: const WidgetStatePropertyAll(0),
                onChanged: (_) => setState(() {}),
              ),
              Expanded(
                child: switch (sections) {
                  AsyncData(:final value) => _list(department!, value),
                  AsyncError() => Center(
                    child: Text(
                      "Couldn't load the sections. Check your connection.",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: scheme.onSurfaceVariant),
                    ),
                  ),
                  _ => const Center(child: CircularProgressIndicator()),
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _list(RoutineDepartmentSlug department, RoutineSectionList list) {
    final choices = [
      for (final c in sectionChoices(list.sections))
        if (c.group == null) c,
    ];
    final shown = _query.text.trim().isEmpty
        ? [
            for (final c in choices)
              if (isRegularSection(c.section)) c,
          ]
        : matchSections(choices, _query.text);
    return ListView(
      children: [
        for (final c in shown)
          ListTile(
            title: Text(
              c.label,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            selected:
                widget.current?.department == department &&
                widget.current?.section == c.section,
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => Navigator.of(
              context,
            ).pop<CoverSection>((department: department, section: c.section)),
          ),
      ],
    );
  }
}
