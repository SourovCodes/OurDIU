// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'department.dart';
import 'exam_type.dart';
import 'question_course.dart';
import 'semester.dart';

part 'question_summary.g.dart';

@JsonSerializable()
class QuestionSummary {
  const QuestionSummary({
    required this.id,
    required this.department,
    required this.course,
    required this.semester,
    required this.examType,
  });

  factory QuestionSummary.fromJson(Map<String, Object?> json) =>
      _$QuestionSummaryFromJson(json);

  final int id;
  final Department department;
  final QuestionCourse course;
  final Semester semester;
  final ExamType examType;

  Map<String, Object?> toJson() => _$QuestionSummaryToJson(this);
}
