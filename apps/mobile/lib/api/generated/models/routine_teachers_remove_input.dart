// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_department.dart';

part 'routine_teachers_remove_input.g.dart';

@JsonSerializable()
class RoutineTeachersRemoveInput {
  const RoutineTeachersRemoveInput({
    required this.department,
    required this.initials,
  });

  factory RoutineTeachersRemoveInput.fromJson(Map<String, Object?> json) =>
      _$RoutineTeachersRemoveInputFromJson(json);

  final RoutineDepartment department;
  final List<String> initials;

  Map<String, Object?> toJson() => _$RoutineTeachersRemoveInputToJson(this);
}
