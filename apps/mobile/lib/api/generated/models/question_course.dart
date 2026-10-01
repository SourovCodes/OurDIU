// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'question_course.g.dart';

@JsonSerializable()
class QuestionCourse {
  const QuestionCourse({required this.id, required this.name});

  factory QuestionCourse.fromJson(Map<String, Object?> json) =>
      _$QuestionCourseFromJson(json);

  final int id;
  final String name;

  Map<String, Object?> toJson() => _$QuestionCourseToJson(this);
}
