// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'routine_course_input.g.dart';

@JsonSerializable()
class RoutineCourseInput {
  const RoutineCourseInput({required this.title});

  factory RoutineCourseInput.fromJson(Map<String, Object?> json) =>
      _$RoutineCourseInputFromJson(json);

  final String title;

  Map<String, Object?> toJson() => _$RoutineCourseInputToJson(this);
}
