// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'classified_department.dart';
import 'classified_value.dart';
import 'exam_type.dart';

part 'submission_classification.g.dart';

@JsonSerializable()
class SubmissionClassification {
  const SubmissionClassification({
    required this.department,
    required this.course,
    required this.semester,
    required this.examType,
  });

  factory SubmissionClassification.fromJson(Map<String, Object?> json) =>
      _$SubmissionClassificationFromJson(json);

  final ClassifiedDepartment department;
  final ClassifiedValue course;
  final ClassifiedValue semester;
  final ExamType examType;

  Map<String, Object?> toJson() => _$SubmissionClassificationToJson(this);
}
