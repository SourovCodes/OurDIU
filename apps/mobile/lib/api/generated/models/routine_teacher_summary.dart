// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'routine_teacher_summary.g.dart';

@JsonSerializable()
class RoutineTeacherSummary {
  const RoutineTeacherSummary({
    required this.initials,
    required this.name,
    required this.courses,
    required this.classCount,
  });

  factory RoutineTeacherSummary.fromJson(Map<String, Object?> json) =>
      _$RoutineTeacherSummaryFromJson(json);

  final String initials;
  final String? name;
  final List<String> courses;
  final int classCount;

  Map<String, Object?> toJson() => _$RoutineTeacherSummaryToJson(this);
}
