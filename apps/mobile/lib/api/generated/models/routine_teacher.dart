// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'routine_teacher.g.dart';

@JsonSerializable()
class RoutineTeacher {
  const RoutineTeacher({required this.initials, required this.name});

  factory RoutineTeacher.fromJson(Map<String, Object?> json) =>
      _$RoutineTeacherFromJson(json);

  final String initials;
  final String? name;

  Map<String, Object?> toJson() => _$RoutineTeacherToJson(this);
}
