// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

@JsonEnum()
enum RoutineWarningKind {
  @JsonValue('section_clash')
  sectionClash('section_clash'),
  @JsonValue('room_clash')
  roomClash('room_clash'),
  @JsonValue('teacher_clash')
  teacherClash('teacher_clash'),
  @JsonValue('duplicate')
  duplicate('duplicate'),
  @JsonValue('untitled_course')
  untitledCourse('untitled_course'),

  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const RoutineWarningKind(this.json);

  factory RoutineWarningKind.fromJson(String json) =>
      values.firstWhere((e) => e.json == json, orElse: () => $unknown);

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();

  /// Returns all defined enum values excluding the $unknown value.
  static List<RoutineWarningKind> get $valuesDefined =>
      values.where((value) => value != $unknown).toList();
}
