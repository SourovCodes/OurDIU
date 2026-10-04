// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'routine_course.g.dart';

@JsonSerializable()
class RoutineCourse {
  const RoutineCourse({required this.code, required this.title});

  factory RoutineCourse.fromJson(Map<String, Object?> json) =>
      _$RoutineCourseFromJson(json);

  final String code;
  final String? title;

  Map<String, Object?> toJson() => _$RoutineCourseToJson(this);
}
