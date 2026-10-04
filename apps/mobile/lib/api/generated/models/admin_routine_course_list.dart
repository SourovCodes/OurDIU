// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'admin_routine_course.dart';

part 'admin_routine_course_list.g.dart';

@JsonSerializable()
class AdminRoutineCourseList {
  const AdminRoutineCourseList({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.all,
    required this.titled,
    required this.version,
  });

  factory AdminRoutineCourseList.fromJson(Map<String, Object?> json) =>
      _$AdminRoutineCourseListFromJson(json);

  final List<AdminRoutineCourse> items;
  final int page;
  final int pageSize;
  final int total;
  final int all;
  final int titled;
  final String? version;

  Map<String, Object?> toJson() => _$AdminRoutineCourseListToJson(this);
}
