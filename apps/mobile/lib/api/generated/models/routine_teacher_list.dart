// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_teacher_summary.dart';
import 'routine_version.dart';

part 'routine_teacher_list.g.dart';

@JsonSerializable()
class RoutineTeacherList {
  const RoutineTeacherList({required this.version, required this.teachers});

  factory RoutineTeacherList.fromJson(Map<String, Object?> json) =>
      _$RoutineTeacherListFromJson(json);

  final RoutineVersion version;
  final List<RoutineTeacherSummary> teachers;

  Map<String, Object?> toJson() => _$RoutineTeacherListToJson(this);
}
