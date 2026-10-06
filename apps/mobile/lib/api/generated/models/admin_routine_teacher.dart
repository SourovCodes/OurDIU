// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_department.dart';

part 'admin_routine_teacher.g.dart';

@JsonSerializable()
class AdminRoutineTeacher {
  const AdminRoutineTeacher({
    required this.department,
    required this.initials,
    required this.name,
    required this.designation,
    required this.phone,
    required this.email,
    required this.room,
    required this.classes,
    required this.courses,
  });

  factory AdminRoutineTeacher.fromJson(Map<String, Object?> json) =>
      _$AdminRoutineTeacherFromJson(json);

  final RoutineDepartment department;
  final String initials;
  final String? name;
  final String? designation;
  final String? phone;
  final String? email;
  final String? room;
  final int classes;
  final List<String> courses;

  Map<String, Object?> toJson() => _$AdminRoutineTeacherToJson(this);
}
