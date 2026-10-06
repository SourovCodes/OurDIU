// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'routine_teacher.g.dart';

@JsonSerializable()
class RoutineTeacher {
  const RoutineTeacher({
    required this.initials,
    required this.name,
    required this.designation,
    required this.phone,
    required this.email,
    required this.room,
  });

  factory RoutineTeacher.fromJson(Map<String, Object?> json) =>
      _$RoutineTeacherFromJson(json);

  final String initials;
  final String? name;
  final String? designation;
  final String? phone;
  final String? email;
  final String? room;

  Map<String, Object?> toJson() => _$RoutineTeacherToJson(this);
}
