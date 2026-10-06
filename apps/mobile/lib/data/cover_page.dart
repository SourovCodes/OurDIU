import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/generated/export.dart';
import '../auth/session.dart';
import 'prefs.dart';
import 'routine.dart';
import 'taxonomy.dart';

// The cover page maker (docs/PLAN.md, decisions 39–43), as on the website's
// /cover-page: the templates and their fields (as `@ourdiu/shared/cover-pages`),
// what's filled in from the account and the saved routine, and the student's own
// details kept on the phone. The API makes the page; nothing is kept there.

/// In the order the website lists them.
final coverTemplates = CoverPageTemplate.$valuesDefined;

String coverTemplateName(CoverPageTemplate t) => switch (t) {
  CoverPageTemplate.assignment => 'Assignment',
  CoverPageTemplate.labReport => 'Lab report',
  CoverPageTemplate.groupAssignment => 'Group assignment',
  CoverPageTemplate.finalLabReport => 'Final lab report',
  CoverPageTemplate.presentation => 'Presentation',
  CoverPageTemplate.$unknown => 'Cover page',
};

/// Every text field, with its longest allowed value (`COVER_PAGE_FIELDS`).
enum CoverField {
  courseCode(20, 'Course code', 'e.g. CSE311'),
  courseTitle(120, 'Course title', 'e.g. Operating Systems'),
  topic(160, 'Topic', 'What the assignment is about'),
  experimentNo(10, 'Experiment no.', 'e.g. 2'),
  experimentName(160, 'Experiment name', 'e.g. Round-robin scheduling'),
  teacherName(80, 'Teacher', null),
  teacherDesignation(80, 'Designation', 'e.g. Assistant Professor'),
  teacherDepartment(
    80,
    'Department',
    'e.g. Department of Software Engineering',
  ),
  studentName(80, 'Name', null),
  studentId(20, 'Student ID', 'e.g. 241-15-047'),
  section(20, 'Section', 'e.g. 67_B'),
  semester(20, 'Semester', null),
  studentDepartment(
    80,
    'Department',
    'e.g. Department of Software Engineering',
  ),
  date(20, 'Date of submission', null);

  const CoverField(this.maxLength, this.label, this.hint);

  final int maxLength;
  final String label;
  final String? hint;
}

const maxCoverMembers = 6;
const maxMemberName = 80;
const maxMemberId = 20;

bool isGroupTemplate(CoverPageTemplate t) =>
    t == CoverPageTemplate.groupAssignment;

/// What the work is, under the course: a topic, or the experiment.
List<CoverField> workFields(CoverPageTemplate t) => switch (t) {
  CoverPageTemplate.labReport => const [
    CoverField.experimentNo,
    CoverField.experimentName,
  ],
  CoverPageTemplate.finalLabReport => const [],
  _ => const [CoverField.topic],
};

/// The fields a template prints (`COVER_PAGE_TEMPLATE_FIELDS`).
List<CoverField> templateFields(CoverPageTemplate t) => [
  CoverField.courseCode,
  CoverField.courseTitle,
  ...workFields(t),
  CoverField.teacherName,
  CoverField.teacherDesignation,
  CoverField.teacherDepartment,
  if (!isGroupTemplate(t)) ...[CoverField.studentName, CoverField.studentId],
  CoverField.section,
  CoverField.semester,
  CoverField.studentDepartment,
  CoverField.date,
];

typedef CoverMember = ({String name, String id});

/// What the API makes the page from: only the template's fields, so a topic
/// typed for an assignment doesn't reach a final lab report's page.
CoverPageInput coverPageInput(
  CoverPageTemplate t,
  Map<CoverField, String> values, {
  List<CoverMember> members = const [],
}) {
  final fields = templateFields(t);
  String? v(CoverField f) =>
      fields.contains(f) ? (values[f] ?? '').trim() : null;
  return CoverPageInput(
    courseCode: v(CoverField.courseCode),
    courseTitle: v(CoverField.courseTitle),
    topic: v(CoverField.topic),
    experimentNo: v(CoverField.experimentNo),
    experimentName: v(CoverField.experimentName),
    teacherName: v(CoverField.teacherName),
    teacherDesignation: v(CoverField.teacherDesignation),
    teacherDepartment: v(CoverField.teacherDepartment),
    studentName: v(CoverField.studentName),
    studentId: v(CoverField.studentId),
    section: v(CoverField.section),
    semester: v(CoverField.semester),
    studentDepartment: v(CoverField.studentDepartment),
    date: v(CoverField.date),
    members: isGroupTemplate(t)
        ? [
            for (final m in members)
              if (m.name.trim().isNotEmpty || m.id.trim().isNotEmpty)
                CoverPageMember(name: m.name.trim(), id: m.id.trim()),
          ]
        : null,
  );
}

/// What the page leaves blank that a teacher would miss, as the preview names
/// it: "topic", "your ID".
List<String> coverBlanks(CoverPageTemplate t, CoverPageInput i) {
  bool blank(String? v) => v == null || v.trim().isEmpty;
  return [
    if (blank(i.courseCode) && blank(i.courseTitle)) 'course',
    if (workFields(t).contains(CoverField.topic) && blank(i.topic)) 'topic',
    if (t == CoverPageTemplate.labReport && blank(i.experimentName))
      'experiment',
    if (blank(i.teacherName)) 'teacher',
    if (isGroupTemplate(t)) ...[
      if (i.members?.isEmpty ?? true) 'members',
    ] else ...[
      if (blank(i.studentName)) 'your name',
      if (blank(i.studentId)) 'your ID',
    ],
  ];
}

/// "topic", "topic and your ID", "course, topic and your ID".
String listed(List<String> items) => switch (items) {
  [] => '',
  [final one] => one,
  _ => '${items.sublist(0, items.length - 1).join(', ')} and ${items.last}',
};

/// The day in Dhaka.
DateTime _dhaka(DateTime at) => at.toUtc().add(const Duration(hours: 6));

/// DIU's terms run Spring (Jan–Apr), Summer (May–Aug) and Fall (Sep–Dec).
String semesterOn(DateTime at) {
  final d = _dhaka(at);
  final term = d.month <= 4
      ? 'Spring'
      : d.month <= 8
      ? 'Summer'
      : 'Fall';
  return '$term ${d.year}';
}

/// A date as DIU's forms write it, dd/mm/yyyy, in Dhaka.
String dhakaDate(DateTime at) {
  final d = _dhaka(at);
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(d.day)}/${two(d.month)}/${d.year}';
}

/// A student ID's department code (`ID_DEPARTMENT_CODES` in the shared package).
const _idDepartments = {
  '11': 'BA',
  '15': 'CSE',
  '16': 'CIS',
  '23': 'TE',
  '33': 'EEE',
  '34': 'NFE',
  '35': 'SWE',
  '47': 'CE',
  '55': 'AS',
  '58': 'ACC',
  '59': 'GEB',
};
const _programCodes = {'101': 'CSE'};

/// A student ID's department's short name ("CSE"), or null when it's not known.
String? departmentOfStudentId(String studentId) {
  final dashed = RegExp(r'^\d{3}-(\d{2})-\d{3,5}$').firstMatch(studentId);
  if (dashed != null) return _idDepartments[dashed[1]];
  if (RegExp(r'^\d{16}$').hasMatch(studentId)) {
    return _programCodes[studentId.substring(10, 13)];
  }
  return null;
}

/// "Department of Computer Science and Engineering", by short name ("CSE").
String departmentLabel(String short, Map<String, String> names) =>
    'Department of ${names[short.toUpperCase()] ?? short}';

/// How each routine's own courses are coded (SWE's are "SE…"). Its routine also
/// lists courses other departments teach (ENG101, MAT101), whose teachers aren't
/// in the department: their department is left for the student to type.
const _ownCoursePrefixes = {
  'CSE': ['CSE'],
  'EEE': ['EEE'],
  'SWE': ['SWE', 'SE'],
};

bool _ownCourse(String code, String department) =>
    (_ownCoursePrefixes[department] ?? [department]).any(
      (prefix) =>
          RegExp('^$prefix\\s?\\d', caseSensitive: false).hasMatch(code),
    );

/// A course in the saved section's week, with who takes it.
typedef CoverCourse = ({
  String code,
  String title,
  String teacherInitials,
  String teacherName,
  String teacherDesignation,
  String teacherDepartment,
});

/// A section's courses, once each, with who takes them, by code.
List<CoverCourse> routineCourses(
  List<RoutineClass> classes,
  String department,
  Map<String, String> names,
) {
  final courses = <String, CoverCourse>{};
  for (final c in classes) {
    courses.putIfAbsent(
      c.course.code,
      () => (
        code: c.course.code,
        title: c.course.title ?? '',
        teacherInitials: c.teacher?.initials ?? '',
        teacherName: c.teacher?.name ?? '',
        teacherDesignation: c.teacher?.designation ?? '',
        teacherDepartment: _ownCourse(c.course.code, department)
            ? departmentLabel(department, names)
            : '',
      ),
    );
  }
  return courses.values.toList()..sort((a, b) => a.code.compareTo(b.code));
}

/// What the maker starts from: the student's details and their section's
/// courses, from the account, the saved routine and what the phone kept.
typedef CoverStart = ({
  Map<CoverField, String> values,

  /// The section the courses are of, and its routine's department.
  CoverSection? section,
  List<CoverCourse> courses,

  /// Departments' names by short name ("CSE"), for "Department of …".
  Map<String, String> names,
});

/// A section in a live routine.
typedef CoverSection = ({RoutineDepartmentSlug department, String section});

/// The student's own details the phone keeps for next time, never the work's.
const rememberedFields = [
  CoverField.studentName,
  CoverField.studentId,
  CoverField.section,
  CoverField.studentDepartment,
];
const _rememberedKey = 'cover_page_details';
const _sectionKey = 'cover_page_section';

/// The section picked here, without a saved routine: kept so its courses come
/// up next time. It doesn't change the Class Routine's "My section".
Future<void> rememberSection(SharedPreferences prefs, CoverSection s) =>
    prefs.setString(_sectionKey, '${s.department.json}|${s.section}');

CoverSection? _rememberedSection(SharedPreferences prefs) {
  final [department, section] = [
    ...(prefs.getString(_sectionKey) ?? '').split('|'),
    '',
  ].take(2).toList();
  final d = departmentFrom(department);
  return d == null || section.isEmpty
      ? null
      : (department: d, section: section);
}

Map<CoverField, String> readRemembered(Map<String, Object?>? json) => {
  for (final f in rememberedFields)
    if (json?[f.name] case final String v when v.isNotEmpty) f: v,
};

/// Keeps the student's own details on the phone.
Future<void> rememberDetails(
  SharedPreferences prefs,
  Map<CoverField, String> values,
) => prefs.setString(
  _rememberedKey,
  jsonEncode({
    for (final f in rememberedFields) f.name: (values[f] ?? '').trim(),
  }),
);

/// A section's courses with who takes them, from its week in the routine.
Future<List<CoverCourse>> sectionCourses(
  Future<RoutineSection> week,
  CoverSection s,
  Map<String, String> names,
) async =>
    routineCourses((await week).classes, departmentName(s.department), names);

/// Clock for the semester and the date; tests fix it.
final coverPageClockProvider = Provider<DateTime Function()>(
  (ref) => DateTime.now,
);

final coverStartProvider = FutureProvider.autoDispose<CoverStart>((ref) async {
  // Each part is optional: offline, signed out or without a routine, the rest
  // is still filled in.
  Future<T?> maybe<T>(Future<T> f) async {
    try {
      return await f;
    } on Object {
      return null;
    }
  }

  final prefs = ref.read(prefsProvider);
  final saved = ref.watch(myRoutineChoiceProvider);
  final (profile, taxonomy, mine) = await (
    maybe(ref.watch(profileProvider.future)),
    maybe(ref.watch(taxonomyProvider.future)),
    // A teacher's week has no section to fill in.
    saved is SavedSection
        ? maybe(ref.watch(myRoutineProvider.future))
        : Future.value(null),
  ).wait;

  final names = {
    for (final d in taxonomy?.departments ?? const <DepartmentListItem>[])
      d.shortName.toUpperCase(): d.name,
  };
  // The Class Routine's section, else one picked here before.
  final CoverSection? section = mine != null && mine.section.isNotEmpty
      ? (department: mine.saved.department, section: mine.section)
      : _rememberedSection(prefs);
  final courses = mine != null && section != null
      ? routineCourses(mine.classes, departmentName(section.department), names)
      : section != null
      ? await maybe(
              sectionCourses(
                ref.read(
                  routineSectionProvider((
                    department: section.department,
                    section: section.section,
                  )).future,
                ),
                section,
                names,
              ),
            ) ??
            const []
      : const <CoverCourse>[];

  final studentId = profile?.studentId ?? '';
  final department =
      departmentOfStudentId(studentId) ??
      (section == null ? null : departmentName(section.department));
  final now = ref.read(coverPageClockProvider)();

  Map<String, Object?>? kept;
  try {
    final raw = prefs.getString(_rememberedKey);
    kept = raw == null ? null : jsonDecode(raw) as Map<String, Object?>;
  } on Object {
    kept = null;
  }

  return (
    values: {
      CoverField.studentName: profile?.name ?? '',
      CoverField.studentId: studentId,
      CoverField.section: section?.section ?? '',
      CoverField.semester: semesterOn(now),
      CoverField.studentDepartment: department == null
          ? ''
          : departmentLabel(department, names),
      CoverField.date: dhakaDate(now),
      // What the phone kept wins over the account's: the student may write their
      // name differently on covers.
      ...readRemembered(kept),
    },
    section: courses.isEmpty ? null : section,
    courses: courses,
    names: names,
  );
});

/// A cover page made by the API: the file and its name.
typedef CoverFile = ({Uint8List bytes, String name});

enum CoverFormat {
  pdf('application/pdf'),
  docx(
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );

  const CoverFormat(this.mimeType);

  final String mimeType;
}

/// Makes the page as a PDF or a Word file. The generated client streams text,
/// so the bytes are asked for here.
Future<CoverFile> makeCoverPage(
  Dio dio,
  CoverPageTemplate template,
  CoverPageInput input,
  CoverFormat format,
) async {
  final res = await dio.post<List<int>>(
    '/api/v1/cover-page/${template.json}/${format.name}',
    // The API takes a missing field, not null, for a blank one.
    data: {
      for (final MapEntry(:key, :value) in input.toJson().entries)
        if (value != null)
          key: value is List<CoverPageMember>
              ? [for (final m in value) m.toJson()]
              : value,
    },
    options: Options(responseType: ResponseType.bytes),
  );
  final name =
      RegExp(r'filename="([^"]+)"')
          .firstMatch(res.headers.value('content-disposition') ?? '')?[1] ??
      'cover-page.${format.name}';
  return (bytes: Uint8List.fromList(res.data ?? const []), name: name);
}
