// Test data shaped like the API's responses.
import 'package:diuqbank/api/generated/export.dart';

Uploader uploader(String name) =>
    Uploader(id: name, username: name, name: name, image: null);

Submission submission(
  int id, {
  SubmissionStatus status = SubmissionStatus.published,
  String? section,
  String? batch,
  Uploader? uploader,
  int likes = 0,
}) => Submission(
  id: id,
  status: status,
  fileSize: 1000,
  createdAt: DateTime.utc(2026),
  likeCount: likes,
  dislikeCount: 0,
  viewCount: 0,
  section: section,
  batch: batch,
  uploader: uploader,
  fileUrl: status == SubmissionStatus.published
      ? 'https://files.example/$id.pdf'
      : null,
);

QuestionDetail questionDetail(
  List<Submission> submissions, {
  int pendingReview = 0,
}) => QuestionDetail(
  id: 7,
  department: const Department(
    id: 1,
    name: 'Computer Science',
    shortName: 'CSE',
  ),
  course: const QuestionCourse(id: 3, name: 'Data Structures'),
  semester: const Semester(id: 1, name: 'Fall 25'),
  examType: const ExamType(id: 1, name: 'Final'),
  submissionCounts: SubmissionCounts(
    published: submissions
        .where((s) => s.status == SubmissionStatus.published)
        .length,
    pendingReview: pendingReview,
    rejected: 0,
  ),
  viewCount: 0,
  submissions: submissions,
  viewToken: 'token-7',
);

const cse = DepartmentListItem(
  id: 5,
  name: 'Computer Science and Engineering',
  shortName: 'CSE',
  publishedCount: 1220,
);
const swe = DepartmentListItem(
  id: 13,
  name: 'Software Engineering',
  shortName: 'SWE',
  publishedCount: 646,
);

const taxonomy = Taxonomy(
  departments: [swe, cse],
  courses: [
    CourseListItem(
      id: 198,
      name: 'Mathematics I',
      departmentId: 5,
      publishedCount: 1,
    ),
    CourseListItem(
      id: 199,
      name: 'Mathematics II',
      departmentId: 5,
      publishedCount: 1,
    ),
    CourseListItem(
      id: 200,
      name: 'Data Structures',
      departmentId: 5,
      publishedCount: 1,
    ),
    CourseListItem(
      id: 300,
      name: 'Structured Programming',
      departmentId: 13,
      publishedCount: 1,
    ),
  ],
  semesters: [
    Semester(id: 1, name: 'Fall 25'),
    Semester(id: 2, name: 'Summer 25'),
    Semester(id: 3, name: 'Spring 25'),
    Semester(id: 4, name: 'Fall 24'),
    Semester(id: 5, name: 'Summer 24'),
  ],
  examTypes: [
    ExamType(id: 1, name: 'Final'),
    ExamType(id: 2, name: 'Midterm'),
    ExamType(id: 3, name: 'Quiz'),
  ],
);

Question question(
  int id, {
  String course = 'Mathematics I',
  int courseId = 198,
  String exam = 'Final',
  String semester = 'Fall 25',
  int papers = 1,
  int views = 0,
}) => Question(
  id: id,
  department: const Department(
    id: 5,
    name: 'Computer Science and Engineering',
    shortName: 'CSE',
  ),
  course: QuestionCourse(id: courseId, name: course),
  semester: Semester(id: id, name: semester),
  examType: ExamType(id: exam.length, name: exam),
  submissionCounts: SubmissionCounts(
    published: papers,
    pendingReview: 0,
    rejected: 0,
  ),
  viewCount: views,
);

QuestionList page(List<Question> items) =>
    QuestionList(items: items, page: 1, pageSize: 20, total: items.length);

Map<String, Object?> profileJson({
  String id = 'me',
  String name = 'Nusrat Jahan',
  String email = 'nusrat@diu.edu.bd',
  int published = 12,
  int views = 4180,
  bool canContribute = true,
}) => {
  'id': id,
  'name': name,
  'email': email,
  'username': 'nusrat',
  'image': null,
  'publishedCount': published,
  'viewCount': views,
  'canContribute': canContribute,
};

/// One of your papers as the API sends it: Data Structures, CSE Final Fall 25.
Map<String, Object?> myPaperJson(
  int id, {
  String status = 'pending_review',
  String? analysis = 'completed',
  String? flag,
  bool? matches = true,
  bool autoPublished = false,
  Map<String, Object?>? aiSemester,
  int? questionId = 7,
  int views = 0,
  int? courseId = 200,
}) => {
  'id': id,
  'status': status,
  'fileSize': 1000,
  'createdAt': '2026-09-20T10:00:00.000Z',
  'section': null,
  'batch': null,
  'questionId': questionId,
  'likeCount': 0,
  'dislikeCount': 0,
  'viewCount': views,
  'classification': {
    'department': {
      'id': 5,
      'name': 'Computer Science and Engineering',
      'shortName': 'CSE',
    },
    'course': {
      'id': courseId,
      'name': courseId == null ? 'Compiler Construction' : 'Data Structures',
    },
    'semester': {'id': 1, 'name': 'Fall 25'},
    'examType': {'id': 1, 'name': 'Final'},
  },
  'autoPublished': autoPublished,
  'rejectionReason': null,
  'changesRequested': null,
  'unread': 0,
  'messages': <Object?>[],
  'analysis': analysis == null
      ? null
      : {'status': analysis, 'flag': flag, 'matches': matches},
  'analysisDetail': analysis == null
      ? null
      : {
          'status': analysis,
          'requestedAt': '2026-09-20T10:00:00.000Z',
          'completedAt': analysis == 'completed'
              ? '2026-09-20T10:00:30.000Z'
              : null,
          'isQuestionPaper': analysis == 'completed' ? true : null,
          'paperCount': analysis == 'completed'
              ? (flag == 'multiple_papers' ? 3 : 1)
              : null,
          'note': null,
          'flag': flag,
          'values': analysis == 'completed'
              ? {
                  'department': {
                    'id': 5,
                    'name': 'Computer Science and Engineering',
                    'shortName': 'CSE',
                  },
                  'course': {'id': 200, 'name': 'Data Structures'},
                  'semester': aiSemester ?? {'id': 1, 'name': 'Fall 25'},
                  'examType': {'id': 1, 'name': 'Final'},
                  'section': null,
                  'batch': null,
                }
              : null,
        },
};
