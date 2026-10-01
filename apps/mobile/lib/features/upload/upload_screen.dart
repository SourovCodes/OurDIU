import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pdfrx/pdfrx.dart';

import '../../api/api.dart';
import '../../api/generated/export.dart';
import '../../auth/session.dart';
import '../../data/format.dart';
import '../../data/questions.dart';
import '../../data/settings.dart';
import '../../data/taxonomy.dart';
import '../../theme/exam_shape.dart';
import '../../widgets/state_message.dart';
import 'papers.dart';

/// The first page of a PDF on disk. Tests swap in a placeholder.
final pdfThumbnailProvider = Provider<Widget Function(String path)>(
  (ref) =>
      (path) => PdfDocumentViewBuilder.file(
        path,
        builder: (context, document) =>
            PdfPageView(document: document, pageNumber: 1),
      ),
);

/// A semester as users type it: a term and a two-digit year, e.g. "Fall 25".
/// Returns the name as the catalog spells it, or null if it isn't one.
String? parseSemester(String input) {
  final match = RegExp(
    r'^(spring|summer|fall|short)\s*(\d{2})$',
    caseSensitive: false,
  ).firstMatch(input.trim());
  if (match == null) return null;
  final year = int.parse(match[2]!);
  if (year < 15 || year > 30) return null;
  final term = match[1]!.toLowerCase();
  return '${term[0].toUpperCase()}${term.substring(1)} ${match[2]}';
}

/// Share a paper: the file, then where it belongs, in the order students know
/// it. With [editing], the same form corrects a paper's details instead.
class UploadScreen extends ConsumerStatefulWidget {
  const UploadScreen({super.key, this.pdf, this.editing})
    : assert((pdf == null) != (editing == null));

  final PickedPdf? pdf;
  final MySubmissionDetail? editing;

  @override
  ConsumerState<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends ConsumerState<UploadScreen> {
  late PaperDetails _details = widget.editing == null
      ? const PaperDetails()
      : PaperDetails.of(widget.editing!);
  late PickedPdf? _pdf = widget.pdf;
  late final _section = TextEditingController(text: _details.section);
  late final _batch = TextEditingController(text: _details.batch);
  var _defaulted = false;
  var _sending = false;
  double? _progress;
  String? _error;

  bool get _editing => widget.editing != null;

  @override
  void dispose() {
    _section.dispose();
    _batch.dispose();
    super.dispose();
  }

  /// Starts on the department you share most, or the one you last read.
  void _defaultDepartment(Taxonomy taxonomy) {
    if (_defaulted || _editing || _details.hasDepartment) return;
    // Watched: opened straight from a share, your papers may still be loading.
    final papers = ref.watch(myPapersProvider);
    if (papers.isLoading && !papers.hasValue) return;
    final mine = papers.value ?? const [];
    final counts = <int, int>{};
    for (final p in mine) {
      if (p.classification.department.id case final id?) {
        counts[id] = (counts[id] ?? 0) + 1;
      }
    }
    int? id;
    if (counts.isNotEmpty) {
      id = (counts.entries.toList()..sort((a, b) => b.value - a.value))
          .first
          .key;
    } else {
      final recent = ref.read(recentCoursesProvider);
      id = taxonomy.courses
          .where((c) => recent.contains(c.id))
          .firstOrNull
          ?.departmentId;
    }
    _defaulted = true;
    if (id != null) _details = _details.copyWith(department: (id, null));
  }

  Future<void> _pickDepartment(Taxonomy taxonomy) async {
    final departments = [...taxonomy.departments]
      ..sort((a, b) => a.shortName.compareTo(b.shortName));
    final choice = await _choose(
      title: 'Department',
      options: [
        for (final d in departments)
          _Option(d.id, '${d.shortName} · ${d.name}', search: d.name),
      ],
      newLabel: 'department',
    );
    if (choice == null) return;
    setState(() {
      _details = _details.copyWith(
        department: (choice.id, choice.newName),
        course: (null, null),
      );
    });
  }

  Future<void> _pickCourse(Taxonomy taxonomy) async {
    final courses = [
      for (final c in taxonomy.courses)
        if (c.departmentId == _details.departmentId) c,
    ]..sort((a, b) => a.name.compareTo(b.name));
    final recent = ref.read(recentCoursesProvider);
    final choice = await _choose(
      title: 'CourseListItem',
      options: [for (final c in courses) _Option(c.id, c.name)],
      recent: [
        for (final id in recent)
          if (courses.where((c) => c.id == id).firstOrNull case final c?)
            _Option(c.id, c.name),
      ],
      newLabel: 'course',
    );
    if (choice == null) return;
    setState(
      () => _details = _details.copyWith(course: (choice.id, choice.newName)),
    );
  }

  Future<void> _pickSemester(List<Semester> semesters) async {
    final choice = await _choose(
      title: 'Semester',
      options: [for (final s in semesters) _Option(s.id, s.name)],
      newLabel: 'semester',
      parseNew: parseSemester,
      newHint: 'A term and a year, like Fall 25.',
    );
    if (choice == null) return;
    setState(() {
      // A typed name that's already in the catalog is that entry.
      final existing = semesters
          .where((s) => s.name == choice.newName)
          .firstOrNull;
      _details = _details.copyWith(
        semester: existing != null
            ? (existing.id, null)
            : (choice.id, choice.newName),
      );
    });
  }

  Future<_Choice?> _choose({
    required String title,
    required List<_Option> options,
    List<_Option> recent = const [],
    required String newLabel,
    String? Function(String)? parseNew,
    String? newHint,
  }) => showModalBottomSheet<_Choice>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (context) => _PickSheet(
      title: title,
      options: options,
      recent: recent,
      newLabel: newLabel,
      parseNew: parseNew,
      newHint: newHint,
    ),
  );

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final details = _details.copyWith(
      section: _section.text,
      batch: _batch.text,
    );
    setState(() {
      _sending = true;
      _progress = _editing ? null : 0;
      _error = null;
    });
    try {
      if (_editing) {
        final updated = await ref
            .read(qbApiProvider)
            .account
            .putApiV1MeSubmissionsIdClassification(
              id: widget.editing!.id,
              body: details.toClassification(),
            );
        ref.invalidate(myPapersProvider);
        if (mounted) context.pop(updated);
      } else {
        final created = await uploadPaper(
          ref.read(dioProvider),
          _pdf!,
          details,
          onProgress: (p) {
            if (mounted) setState(() => _progress = p);
          },
        );
        ref
          ..invalidate(myPapersProvider)
          ..invalidate(profileProvider);
        if (mounted) context.go('/account/papers/${created.id}');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _progress = null;
        _error = switch (e) {
          _ when isOffline(e) =>
            "Couldn't reach the server. Your details are kept; try again.",
          DioException(response: Response(statusCode: 429)) =>
            "You're uploading too fast. Please wait a minute and try again.",
          _ => apiErrorMessage(e) ?? "Couldn't upload the paper. Try again.",
        };
      });
    }
  }

  Future<void> _replace() async {
    final sources = ref.read(paperSourcesProvider);
    final pdf = await (_pdf?.source == PaperSource.scan
        ? sources.scan()
        : sources.pick());
    if (pdf == null || !mounted) return;
    if (pdf.bytes > maxPaperBytes) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'This PDF is ${fileSize(pdf.bytes)}; the limit is '
            '${fileSize(maxPaperBytes)}.',
          ),
        ),
      );
      return;
    }
    setState(() => _pdf = pdf);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Close',
          icon: const Icon(Icons.close_rounded),
          onPressed: _sending ? null : () => context.pop(),
        ),
        title: Text(_editing ? 'Edit details' : 'Share a paper'),
      ),
      body: switch (ref.watch(taxonomyProvider)) {
        AsyncData(:final value) => _form(context, value),
        AsyncError(:final error) => StateMessage(
          icon: isOffline(error)
              ? Icons.cloud_off_rounded
              : Icons.error_outline_rounded,
          title: isOffline(error)
              ? "You're offline"
              : "Couldn't load the course list",
          body: 'The form needs the list of courses. Check your connection.',
          actions: [
            FilledButton(
              onPressed: () => ref.invalidate(taxonomyProvider),
              child: const Text('Try again'),
            ),
          ],
        ),
        _ => const Center(child: CircularProgressIndicator()),
      },
    );
  }

  Widget _form(BuildContext context, Taxonomy taxonomy) {
    _defaultDepartment(taxonomy);
    final theme = Theme.of(context);
    final muted = TextStyle(color: theme.colorScheme.onSurfaceVariant);
    final d = _details;
    final department = taxonomy.departments
        .where((x) => x.id == d.departmentId)
        .firstOrNull;
    final course = taxonomy.courses
        .where((x) => x.id == d.courseId)
        .firstOrNull;
    final semesters = [...taxonomy.semesters]
      ..sort((a, b) => compareSemesters(a.name, b.name));
    final quick = semesters.take(4).toList();
    final semester = semesters.where((s) => s.id == d.semesterId).firstOrNull;
    final semesterName = semester?.name ?? d.newSemester;
    final examTypes = [...taxonomy.examTypes]
      ..sort(
        (a, b) => examKind(a.name).index != examKind(b.name).index
            ? examKind(a.name).index - examKind(b.name).index
            : a.name.compareTo(b.name),
      );
    final sectionLabel = theme.textTheme.titleMedium?.copyWith(
      fontWeight: FontWeight.w600,
    );

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              if (_pdf case final pdf?) ...[
                _FileCard(pdf: pdf, onReplace: _sending ? null : _replace),
                const SizedBox(height: 22),
              ],
              Text('Where does it belong?', style: sectionLabel),
              const SizedBox(height: 10),
              _Field(
                label: 'Department',
                value: department != null
                    ? '${department.shortName} · ${department.name}'
                    : d.newDepartment,
                isNew: d.newDepartment != null,
                onTap: _sending ? null : () => _pickDepartment(taxonomy),
              ),
              const SizedBox(height: 8),
              _Field(
                label: 'CourseListItem',
                value: course?.name ?? d.newCourse,
                isNew: d.newCourse != null,
                onTap: _sending || !d.hasDepartment
                    ? null
                    : () => _pickCourse(taxonomy),
              ),
              const SizedBox(height: 20),
              Text('Exam', style: muted),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final e in examTypes)
                    _ExamChip(
                      name: e.name,
                      selected: d.examTypeId == e.id,
                      onTap: _sending
                          ? null
                          : () => setState(
                              () => _details = d.copyWith(examTypeId: e.id),
                            ),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              Text('Semester', style: muted),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final s in quick)
                    ChoiceChip(
                      label: Text(s.name),
                      selected: d.semesterId == s.id,
                      showCheckmark: false,
                      onSelected: _sending
                          ? null
                          : (_) => setState(
                              () =>
                                  _details = d.copyWith(semester: (s.id, null)),
                            ),
                    ),
                  if (semesterName != null &&
                      !quick.any((s) => s.name == semesterName))
                    ChoiceChip(
                      label: Text(semesterName),
                      selected: true,
                      showCheckmark: false,
                      onSelected: _sending
                          ? null
                          : (_) => _pickSemester(semesters),
                    ),
                  ActionChip(
                    avatar: const Icon(Icons.more_horiz_rounded),
                    label: const Text('Older'),
                    onPressed: _sending ? null : () => _pickSemester(semesters),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                spacing: 10,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _section,
                      enabled: !_sending,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(
                        labelText: 'Section (optional)',
                        hintText: 'e.g. B',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _batch,
                      enabled: !_sending,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Batch (optional)',
                        hintText: 'e.g. 61',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                ],
              ),
              if (!_editing)
                _ExistingPapers(
                  courseId: d.courseId,
                  semesterId: d.semesterId,
                  examTypeId: d.examTypeId,
                ),
              if (d.proposesNew)
                const _Hint(
                  icon: Icons.schedule_rounded,
                  text:
                      'New courses, departments and semesters are added once an '
                      'admin approves them, so this paper waits for review '
                      'instead of going live right away.',
                ),
            ],
          ),
        ),
        _SubmitBar(
          editing: _editing,
          ready: d.complete,
          sending: _sending,
          progress: _progress,
          error: _error,
          onSubmit: _submit,
        ),
      ],
    );
  }
}

class _FileCard extends ConsumerWidget {
  const _FileCard({required this.pdf, required this.onReplace});

  final PickedPdf pdf;
  final VoidCallback? onReplace;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final from = switch (pdf.source) {
      PaperSource.scan => 'Scanned just now',
      PaperSource.files => 'From your files',
      PaperSource.shared => 'Shared from another app',
    };
    return Material(
      color: scheme.surfaceContainer,
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          spacing: 14,
          children: [
            Container(
              width: 52,
              height: 74,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(3),
                boxShadow: const [
                  BoxShadow(color: Color(0x33000000), blurRadius: 3),
                ],
              ),
              child: ref.watch(pdfThumbnailProvider)(pdf.path),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 2,
                children: [
                  Text(
                    pdf.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    [
                      from,
                      if (pdf.pages != null) plural(pdf.pages!, 'page'),
                      fileSize(pdf.bytes),
                    ].join(' · '),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            TextButton(onPressed: onReplace, child: const Text('Replace')),
          ],
        ),
      ),
    );
  }
}

/// A choice that opens a sheet: its label, and the value or "Choose…".
class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.value,
    required this.onTap,
    this.isNew = false,
  });

  final String label;
  final String? value;
  final bool isNew;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final (newBg, newFg) = examColors(context, ExamKind.quiz);
    return Opacity(
      opacity: onTap == null && value == null ? 0.5 : 1,
      child: Material(
        color: scheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(14),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 12, 10),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                      Row(
                        spacing: 6,
                        children: [
                          Flexible(
                            child: Text(
                              value ?? 'Choose…',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodyLarge?.copyWith(
                                color: value == null
                                    ? scheme.onSurfaceVariant
                                    : null,
                              ),
                            ),
                          ),
                          if (isNew)
                            DecoratedBox(
                              decoration: ShapeDecoration(
                                color: newBg,
                                shape: const StadiumBorder(),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 1,
                                ),
                                child: Text(
                                  'New',
                                  style: TextStyle(
                                    color: newFg,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                Icon(Icons.expand_more_rounded, color: scheme.onSurfaceVariant),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// An exam type with its shape; selected, it takes the exam's colours.
class _ExamChip extends StatelessWidget {
  const _ExamChip({
    required this.name,
    required this.selected,
    required this.onTap,
  });

  final String name;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final kind = examKind(name);
    final (container, content) = examColors(context, kind);
    return Semantics(
      selected: selected,
      button: true,
      child: Material(
        color: selected ? container : Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(
            color: selected ? Colors.transparent : scheme.outlineVariant,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 14, 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              spacing: 8,
              children: [
                ExamShape(
                  kind,
                  color: selected ? content : container,
                  size: 24,
                ),
                Text(
                  name,
                  style: TextStyle(
                    color: selected ? content : scheme.onSurface,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// How many papers the chosen exam already has, so a second one comes with
/// its section or batch.
class _ExistingPapers extends ConsumerWidget {
  const _ExistingPapers({
    required this.courseId,
    required this.semesterId,
    required this.examTypeId,
  });

  final int? courseId;
  final int? semesterId;
  final int? examTypeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (courseId == null || semesterId == null || examTypeId == null) {
      return const SizedBox.shrink();
    }
    final list = ref
        .watch(questionPageProvider((courseQuestions(courseId!), 1)))
        .value;
    final existing = list?.items
        .where(
          (q) => q.semester.id == semesterId && q.examType.id == examTypeId,
        )
        .firstOrNull;
    final count = existing?.submissionCounts.published ?? 0;
    if (count == 0) return const SizedBox.shrink();
    return _Hint(
      icon: Icons.info_outline_rounded,
      text:
          'This exam already has ${plural(count, 'paper')}. Share yours if '
          "it's another section or batch, and add them above so students can "
          'tell the papers apart.',
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Material(
        color: scheme.surfaceContainer,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 10,
            children: [
              Icon(icon, color: scheme.primary, size: 20),
              Expanded(
                child: Text(
                  text,
                  style: TextStyle(
                    color: scheme.onSurfaceVariant,
                    fontSize: 13,
                    height: 1.4,
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

class _SubmitBar extends StatelessWidget {
  const _SubmitBar({
    required this.editing,
    required this.ready,
    required this.sending,
    required this.progress,
    required this.error,
    required this.onSubmit,
  });

  final bool editing;
  final bool ready;
  final bool sending;

  /// 0 to 1 while a file uploads.
  final double? progress;
  final String? error;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final label = sending
        ? (editing
              ? 'Saving…'
              : 'Uploading ${((progress ?? 0) * 100).round()}%')
        : (editing ? 'Save details' : 'Upload');
    return Material(
      color: scheme.surface,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            spacing: 6,
            children: [
              if (error != null)
                Text(
                  error!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: scheme.error),
                ),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  onPressed: ready && !sending ? onSubmit : null,
                  style: FilledButton.styleFrom(
                    padding: EdgeInsets.zero,
                    disabledBackgroundColor: sending ? scheme.primary : null,
                    disabledForegroundColor: sending ? scheme.onPrimary : null,
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      if (sending && progress != null)
                        Positioned.fill(
                          child: FractionallySizedBox(
                            alignment: Alignment.centerLeft,
                            widthFactor: progress!.clamp(0, 1),
                            child: ColoredBox(
                              color: scheme.onPrimary.withValues(alpha: 0.22),
                            ),
                          ),
                        ),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        spacing: 8,
                        children: [
                          if (sending)
                            SizedBox.square(
                              dimension: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: scheme.onPrimary,
                              ),
                            )
                          else
                            Icon(
                              editing
                                  ? Icons.check_rounded
                                  : Icons.upload_rounded,
                              size: 20,
                            ),
                          Text(label),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              Text(
                ready
                    ? editing
                          ? "If they match the AI's reading, it's published right away."
                          : "The AI checks it first. If it matches your details, it's published."
                    : 'Choose the course, exam and semester to continue.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Option {
  const _Option(this.id, this.label, {this.search});

  final int id;
  final String label;

  /// Also matched when searching, e.g. a department's full name.
  final String? search;

  bool matches(String query) =>
      label.toLowerCase().contains(query) ||
      (search?.toLowerCase().contains(query) ?? false);
}

/// An existing entry, or a new name to propose.
typedef _Choice = ({int? id, String? newName});

/// A searchable list with recent picks on top and "Add … as a new …".
class _PickSheet extends StatefulWidget {
  const _PickSheet({
    required this.title,
    required this.options,
    required this.recent,
    required this.newLabel,
    this.parseNew,
    this.newHint,
  });

  final String title;
  final List<_Option> options;
  final List<_Option> recent;
  final String newLabel;

  /// Turns typed text into a new entry's name, or null if it isn't valid.
  final String? Function(String)? parseNew;
  final String? newHint;

  @override
  State<_PickSheet> createState() => _PickSheetState();
}

class _PickSheetState extends State<_PickSheet> {
  var _query = '';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final q = _query.trim().toLowerCase();
    final shown = [
      for (final o in widget.options)
        if (q.isEmpty || o.matches(q)) o,
    ];
    final typed = _query.trim().replaceAll(RegExp(r'\s+'), ' ');
    final newName = typed.isEmpty
        ? null
        : (widget.parseNew?.call(typed) ??
              (widget.parseNew == null ? typed : null));
    final exact = widget.options.any(
      (o) => o.label.toLowerCase() == (newName ?? typed).toLowerCase(),
    );
    Widget row(_Option o, {bool recent = false}) => ListTile(
      leading: recent
          ? Icon(Icons.history_rounded, color: scheme.onSurfaceVariant)
          : null,
      title: Text(o.label),
      onTap: () => Navigator.pop(context, (id: o.id, newName: null)),
    );

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 12,
              children: [
                Text(
                  widget.title,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SearchBar(
                  hintText: 'Search ${widget.title.toLowerCase()}s',
                  leading: const Icon(Icons.search_rounded),
                  elevation: const WidgetStatePropertyAll(0),
                  onChanged: (v) => setState(() => _query = v),
                ),
              ],
            ),
          ),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              children: [
                if (q.isEmpty && widget.recent.isNotEmpty) ...[
                  _SheetLabel('You read these recently'),
                  _Group([for (final o in widget.recent) row(o, recent: true)]),
                  _SheetLabel('All ${widget.title.toLowerCase()}s'),
                ],
                _Group([
                  for (final o in shown.take(80)) row(o),
                  if (typed.isNotEmpty && !exact)
                    ListTile(
                      leading: Icon(Icons.add_rounded, color: scheme.primary),
                      title: Text(
                        newName == null
                            ? widget.newHint ?? 'Not a valid name'
                            : 'Add “$newName” as a new ${widget.newLabel}',
                        style: TextStyle(
                          color: newName == null
                              ? scheme.error
                              : scheme.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      onTap: newName == null
                          ? null
                          : () => Navigator.pop(context, (
                              id: null,
                              newName: newName,
                            )),
                    ),
                ]),
                if (widget.newHint != null && typed.isEmpty)
                  _SheetLabel(widget.newHint!),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SheetLabel extends StatelessWidget {
  const _SheetLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(4, 12, 4, 8),
    child: Text(
      text,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onSurfaceVariant,
        fontSize: 13,
      ),
    ),
  );
}

/// Rows in one rounded block, like [RowGroup] elsewhere.
class _Group extends StatelessWidget {
  const _Group(this.children);

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) return const SizedBox.shrink();
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Column(
        spacing: 2,
        children: [
          // Each row on its own Material, so the tile's colour is clipped.
          for (final child in children)
            Material(
              color: Theme.of(context).colorScheme.surfaceContainer,
              child: child,
            ),
        ],
      ),
    );
  }
}
