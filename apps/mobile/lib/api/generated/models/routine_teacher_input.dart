// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'routine_teacher_input.g.dart';

@JsonSerializable()
class RoutineTeacherInput {
  const RoutineTeacherInput({
    required this.name,
    this.phone,
    this.email,
    this.room,
  });

  factory RoutineTeacherInput.fromJson(Map<String, Object?> json) =>
      _$RoutineTeacherInputFromJson(json);

  final String name;
  final String? phone;
  final String? email;
  final String? room;

  Map<String, Object?> toJson() => _$RoutineTeacherInputToJson(this);
}
