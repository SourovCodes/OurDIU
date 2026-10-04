// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_department.dart';

part 'admin_routine_course.g.dart';

@JsonSerializable()
class AdminRoutineCourse {
  const AdminRoutineCourse({
    required this.department,
    required this.code,
    required this.title,
    required this.liveSections,
  });

  factory AdminRoutineCourse.fromJson(Map<String, Object?> json) =>
      _$AdminRoutineCourseFromJson(json);

  final RoutineDepartment department;
  final String code;
  final String? title;
  final int liveSections;

  Map<String, Object?> toJson() => _$AdminRoutineCourseToJson(this);
}
