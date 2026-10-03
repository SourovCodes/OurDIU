// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'department.dart';
import 'exam_type.dart';
import 'question_course.dart';
import 'semester.dart';
import 'submission.dart';
import 'submission_counts.dart';

part 'question_detail.g.dart';

@JsonSerializable()
class QuestionDetail {
  const QuestionDetail({
    required this.id,
    required this.department,
    required this.course,
    required this.semester,
    required this.examType,
    required this.submissionCounts,
    required this.viewCount,
    required this.viewsToday,
    required this.submissions,
    required this.viewToken,
  });

  factory QuestionDetail.fromJson(Map<String, Object?> json) =>
      _$QuestionDetailFromJson(json);

  final int id;
  final Department department;
  final QuestionCourse course;
  final Semester semester;
  final ExamType examType;
  final SubmissionCounts submissionCounts;
  final int viewCount;
  final int? viewsToday;
  final List<Submission> submissions;
  final String viewToken;

  Map<String, Object?> toJson() => _$QuestionDetailToJson(this);
}
