// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'trending_course.dart';

part 'trending_course_list.g.dart';

@JsonSerializable()
class TrendingCourseList {
  const TrendingCourseList({required this.items});

  factory TrendingCourseList.fromJson(Map<String, Object?> json) =>
      _$TrendingCourseListFromJson(json);

  final List<TrendingCourse> items;

  Map<String, Object?> toJson() => _$TrendingCourseListToJson(this);
}
