// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'department.dart';

part 'trending_course.g.dart';

@JsonSerializable()
class TrendingCourse {
  const TrendingCourse({
    required this.id,
    required this.name,
    required this.departmentId,
    required this.publishedCount,
    required this.department,
    required this.viewsToday,
  });

  factory TrendingCourse.fromJson(Map<String, Object?> json) =>
      _$TrendingCourseFromJson(json);

  final int id;
  final String name;
  final int departmentId;
  final int publishedCount;
  final Department department;
  final int viewsToday;

  Map<String, Object?> toJson() => _$TrendingCourseToJson(this);
}
