// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_department.dart';

part 'routine_courses_remove_input.g.dart';

@JsonSerializable()
class RoutineCoursesRemoveInput {
  const RoutineCoursesRemoveInput({
    required this.department,
    required this.codes,
  });

  factory RoutineCoursesRemoveInput.fromJson(Map<String, Object?> json) =>
      _$RoutineCoursesRemoveInputFromJson(json);

  final RoutineDepartment department;
  final List<String> codes;

  Map<String, Object?> toJson() => _$RoutineCoursesRemoveInputToJson(this);
}
