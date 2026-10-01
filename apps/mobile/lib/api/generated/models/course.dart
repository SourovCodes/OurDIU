// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'course.g.dart';

@JsonSerializable()
class Course {
  const Course({
    required this.id,
    required this.name,
    required this.departmentId,
  });

  factory Course.fromJson(Map<String, Object?> json) => _$CourseFromJson(json);

  final int id;
  final String name;
  final int departmentId;

  Map<String, Object?> toJson() => _$CourseToJson(this);
}
