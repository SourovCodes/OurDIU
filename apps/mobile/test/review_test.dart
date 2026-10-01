import 'package:diuqbank/api/generated/export.dart';
import 'package:diuqbank/features/upload/review.dart';
import 'package:diuqbank/features/upload/upload_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fixtures.dart';

MySubmissionDetail paper(Map<String, Object?> json) =>
    MySubmissionDetail.fromJson(json);

PaperStage stage(Map<String, Object?> json) =>
    stageOf(detailStateOf(paper(json)));

void main() {
  test('tells where a paper stands, like the site', () {
    expect(stage(myPaperJson(1, analysis: 'queued')), PaperStage.checking);
    expect(stage(myPaperJson(1, analysis: 'processing')), PaperStage.checking);
    expect(
      stage(myPaperJson(1, status: 'published', autoPublished: true)),
      PaperStage.published,
    );
    expect(stage(myPaperJson(1, status: 'rejected')), PaperStage.rejected);
    expect(stage(myPaperJson(1, matches: false)), PaperStage.checkDetails);
    // Flagged papers and papers without a check wait for an admin.
    expect(
      stage(myPaperJson(1, flag: 'multiple_papers', matches: null)),
      PaperStage.waiting,
    );
    expect(stage(myPaperJson(1, analysis: null)), PaperStage.waiting);
    expect(stage(myPaperJson(1, analysis: 'failed')), PaperStage.waiting);
  });

  test(
    'a paper with a new course waits for an admin even if the AI disagrees',
    () {
      final json = myPaperJson(1, matches: false);
      (json['classification']! as Map)['course'] = {
        'id': null,
        'name': 'Compiler Construction',
      };
      expect(stage(json), PaperStage.waiting);
      expect(
        stageDescription(detailStateOf(paper(json)), autoPublished: false),
        contains('new department, course or semester'),
      );
    },
  );

  test('compares your details with the AI reading', () {
    final p = paper(
      myPaperJson(
        1,
        matches: false,
        aiSemester: {'id': 2, 'name': 'Summer 25'},
      ),
    );
    final rows = compareWithAnalysis(
      p.classification,
      p.analysisDetail!.values!,
    );
    expect(
      [for (final r in rows) (r.label, r.differs)],
      [
        ('Department', false),
        ('CourseListItem', false),
        ('Semester', true),
        ('Exam', false),
      ],
    );
    expect(rows[2].ai, 'Summer 25');
  });

  test('compares names the way the catalog stores them', () {
    expect(
      catalogKey('Data  Structures & Algorithms.'),
      'data structures and algorithms',
    );
    expect(catalogKey('Physics-I'), catalogKey('Physics I'));
  });

  test("the AI's details keep yours where it read nothing", () {
    final p = paper(
      myPaperJson(
        1,
        matches: false,
        aiSemester: {'id': null, 'name': 'Short 25'},
      ),
    );
    final values = p.analysisDetail!.values!;
    final body = aiDetails(
      p.classification,
      AnalysisValues(
        department: values.department,
        course: null,
        semester: values.semester,
        examType: values.examType,
        section: null,
        batch: null,
      ),
      section: 'B',
    );
    expect(body.toJson(), {
      'departmentId': 5,
      'customDepartmentName': null,
      'customDepartmentShortName': null,
      'courseId': 200,
      'customCourseName': null,
      'semesterId': null,
      'customSemesterName': 'Short 25',
      'examTypeId': 1,
      'section': 'B',
      'batch': null,
    });
  });

  test('reads a typed semester as the catalog spells it', () {
    expect(parseSemester('fall 26'), 'Fall 26');
    expect(parseSemester(' Summer26 '), 'Summer 26');
    expect(parseSemester('Winter 25'), isNull);
    expect(parseSemester('Fall 99'), isNull);
  });
}
