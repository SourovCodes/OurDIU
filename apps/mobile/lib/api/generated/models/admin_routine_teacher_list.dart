// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'admin_routine_teacher.dart';

part 'admin_routine_teacher_list.g.dart';

@JsonSerializable()
class AdminRoutineTeacherList {
  const AdminRoutineTeacherList({required this.items});

  factory AdminRoutineTeacherList.fromJson(Map<String, Object?> json) =>
      _$AdminRoutineTeacherListFromJson(json);

  final List<AdminRoutineTeacher> items;

  Map<String, Object?> toJson() => _$AdminRoutineTeacherListToJson(this);
}
