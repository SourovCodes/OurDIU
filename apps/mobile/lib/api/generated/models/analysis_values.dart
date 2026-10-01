// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'extracted_department.dart';
import 'extracted_value.dart';

part 'analysis_values.g.dart';

@JsonSerializable()
class AnalysisValues {
  const AnalysisValues({
    required this.department,
    required this.course,
    required this.semester,
    required this.examType,
    required this.section,
    required this.batch,
  });

  factory AnalysisValues.fromJson(Map<String, Object?> json) =>
      _$AnalysisValuesFromJson(json);

  final ExtractedDepartment? department;
  final ExtractedValue? course;
  final ExtractedValue? semester;
  final ExtractedValue? examType;
  final String? section;
  final String? batch;

  Map<String, Object?> toJson() => _$AnalysisValuesToJson(this);
}
