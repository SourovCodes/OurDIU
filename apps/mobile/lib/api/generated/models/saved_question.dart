// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'department.dart';
import 'exam_type.dart';
import 'question_course.dart';
import 'semester.dart';
import 'submission_counts.dart';

part 'saved_question.g.dart';

@JsonSerializable()
class SavedQuestion {
  const SavedQuestion({
    required this.id,
    required this.department,
    required this.course,
    required this.semester,
    required this.examType,
    required this.submissionCounts,
    required this.viewCount,
    required this.savedAt,
  });

  factory SavedQuestion.fromJson(Map<String, Object?> json) =>
      _$SavedQuestionFromJson(json);

  final int id;
  final Department department;
  final QuestionCourse course;
  final Semester semester;
  final ExamType examType;
  final SubmissionCounts submissionCounts;
  final int viewCount;
  final DateTime savedAt;

  Map<String, Object?> toJson() => _$SavedQuestionToJson(this);
}
