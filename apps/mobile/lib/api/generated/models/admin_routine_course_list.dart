// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'admin_routine_course.dart';

part 'admin_routine_course_list.g.dart';

@JsonSerializable()
class AdminRoutineCourseList {
  const AdminRoutineCourseList({required this.items});

  factory AdminRoutineCourseList.fromJson(Map<String, Object?> json) =>
      _$AdminRoutineCourseListFromJson(json);

  final List<AdminRoutineCourse> items;

  Map<String, Object?> toJson() => _$AdminRoutineCourseListToJson(this);
}
