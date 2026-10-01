// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'course.dart';

part 'course_list.g.dart';

@JsonSerializable()
class CourseList {
  const CourseList({required this.items});

  factory CourseList.fromJson(Map<String, Object?> json) =>
      _$CourseListFromJson(json);

  final List<Course> items;

  Map<String, Object?> toJson() => _$CourseListToJson(this);
}
