// Where an uploader's paper stands, and how it compares with what the AI read.
// Mirrors the site's `app/lib/review.ts` and `app/lib/analysis.ts`.
import '../../api/generated/export.dart';

enum PaperStage {
  /// The AI check is still running.
  checking,
  published,

  /// The AI read other details; using its details (or fixing yours) publishes it.
  checkDetails,

  /// Waiting for an admin: flagged by the AI, new catalog entries, or no check.
  waiting,
  rejected,
}

/// The fields of [MySubmission] and [MySubmissionDetail] the stage depends on.
typedef PaperState = ({
  SubmissionStatus status,
  AnalysisSummary? analysis,
  SubmissionClassification classification,
});

PaperState stateOf(MySubmission s) =>
    (status: s.status, analysis: s.analysis, classification: s.classification);

PaperState detailStateOf(MySubmissionDetail s) =>
    (status: s.status, analysis: s.analysis, classification: s.classification);

/// A department, course or semester that doesn't exist yet: an admin adds it.
bool proposesNewEntries(SubmissionClassification c) =>
    c.department.id == null || c.course.id == null || c.semester.id == null;

PaperStage stageOf(PaperState paper) {
  if (paper.status == SubmissionStatus.published) return PaperStage.published;
  if (paper.status == SubmissionStatus.rejected) return PaperStage.rejected;
  final analysis = paper.analysis;
  if (analysis == null) return PaperStage.waiting;
  return switch (analysis.status) {
    AnalysisStatus.queued || AnalysisStatus.processing => PaperStage.checking,
    AnalysisStatus.completed
        when analysis.flag == null &&
            !proposesNewEntries(paper.classification) &&
            analysis.matches == false =>
      PaperStage.checkDetails,
    _ => PaperStage.waiting,
  };
}

/// One sentence on where the paper stands, like the site's status banner.
String stageDescription(
  PaperState paper, {
  required bool autoPublished,
  String? rejectionReason,
}) {
  final flag = paper.analysis?.flag;
  return switch (stageOf(paper)) {
    PaperStage.checking =>
      'The AI is reading the header to confirm the course, exam and semester. '
          'This usually takes less than a minute; you can leave this page.',
    PaperStage.published =>
      autoPublished
          ? 'Everything the AI read matches your details, so it was published '
                'right away. Thanks for sharing!'
          : 'An admin reviewed it and published it. Thanks for sharing!',
    PaperStage.checkDetails =>
      "The AI read different details from the paper. Use the AI's details or "
          'correct yours to publish it now; otherwise an admin will check.',
    PaperStage.rejected =>
      rejectionReason == null
          ? "An admin reviewed it and didn't publish it. You can withdraw it "
                'and upload a corrected one.'
          : "An admin didn't publish it: $rejectionReason",
    PaperStage.waiting => switch (flag) {
      AnalysisFlag.multiplePapers =>
        'The AI found more than one question paper in this file. Upload each '
            'one on its own so they can be published, then withdraw this file.',
      AnalysisFlag.notAPaper =>
        "The AI doesn't think this file is an exam question paper. An admin "
            'will take a look.',
      _ when proposesNewEntries(paper.classification) =>
        'It adds a new department, course or semester, which an admin approves '
            'before publishing your paper.',
      _ => 'An admin will review your paper soon.',
    },
  };
}

/// Names compared the way the catalog stores them: "&" is "and", spacing and
/// trailing punctuation don't count, "Physics-I" is "Physics I", any case.
String catalogKey(String name) => name
    .replaceAll(RegExp('[‘’]'), "'")
    .replaceAll(RegExp('[“”]'), '"')
    .replaceAll(RegExp(r'\s*[&＆]\s*'), ' and ')
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim()
    .replaceAll(RegExp(r'[.,]+$'), '')
    .trim()
    .replaceAllMapped(
      RegExp(
        r'\s*[-–]\s*(I{1,3}|IV|VI{0,3}|IX|X|\d{1,2})$',
        caseSensitive: false,
      ),
      (m) => ' ${m[1]!.toUpperCase()}',
    )
    .toLowerCase();

typedef Named = ({int? id, String name});

bool _same(Named a, Named b) => a.id != null && b.id != null
    ? a.id == b.id
    : catalogKey(a.name) == catalogKey(b.name);

class ComparisonRow {
  const ComparisonRow({
    required this.label,
    required this.mine,
    required this.ai,
    required this.differs,
  });

  final String label;
  final String? mine;

  /// Null when the AI couldn't read it.
  final String? ai;
  final bool differs;
}

/// Your details next to the AI's reading, field by field. Section and batch are
/// only listed when either side has one.
List<ComparisonRow> compareWithAnalysis(
  SubmissionClassification c,
  AnalysisValues values, {
  String? section,
  String? batch,
}) {
  ComparisonRow entry(String label, Named mine, Named? theirs) => ComparisonRow(
    label: label,
    mine: mine.name,
    ai: theirs?.name,
    differs: theirs != null && !_same(mine, theirs),
  );
  ComparisonRow? detail(String label, String? mine, String? theirs) =>
      mine == null && theirs == null
      ? null
      : ComparisonRow(
          label: label,
          mine: mine,
          ai: theirs,
          differs:
              theirs != null &&
              (mine == null || catalogKey(mine) != catalogKey(theirs)),
        );
  Named? named(int? id, String? name) =>
      name == null ? null : (id: id, name: name);
  return [
    entry(
      'Department',
      (id: c.department.id, name: c.department.shortName ?? c.department.name),
      values.department == null
          ? null
          : (
              id: values.department!.id,
              name: values.department!.shortName ?? values.department!.name,
            ),
    ),
    entry('Course', (
      id: c.course.id,
      name: c.course.name,
    ), named(values.course?.id, values.course?.name)),
    entry('Semester', (
      id: c.semester.id,
      name: c.semester.name,
    ), named(values.semester?.id, values.semester?.name)),
    entry('Exam', (
      id: c.examType.id,
      name: c.examType.name,
    ), named(values.examType?.id, values.examType?.name)),
    ?detail('Section', section, values.section),
    ?detail('Batch', batch, values.batch),
  ];
}

/// The details to send for "Use the AI's details": the AI's reading where it
/// has one, yours elsewhere. The exam type only changes to an existing one (new
/// exam types can't be proposed); section and batch stay yours.
ApiV1MeSubmissionsIdClassificationRequestBody aiDetails(
  SubmissionClassification c,
  AnalysisValues values, {
  String? section,
  String? batch,
}) {
  final dept = values.department;
  final course = values.course;
  final semester = values.semester;
  final examType = values.examType;
  return ApiV1MeSubmissionsIdClassificationRequestBody(
    departmentId: dept != null ? dept.id : c.department.id,
    customDepartmentName: dept != null
        ? (dept.id == null ? dept.name : null)
        : (c.department.id == null ? c.department.name : null),
    customDepartmentShortName: dept != null
        ? (dept.id == null ? dept.shortName : null)
        : (c.department.id == null ? c.department.shortName : null),
    courseId: course != null ? course.id : c.course.id,
    customCourseName: course != null
        ? (course.id == null ? course.name : null)
        : (c.course.id == null ? c.course.name : null),
    semesterId: semester != null ? semester.id : c.semester.id,
    customSemesterName: semester != null
        ? (semester.id == null ? semester.name : null)
        : (c.semester.id == null ? c.semester.name : null),
    examTypeId: examType?.id ?? c.examType.id,
    section: section,
    batch: batch,
  );
}
