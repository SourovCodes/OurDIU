// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

@JsonEnum()
enum MergedKind {
  @JsonValue('question')
  question('question'),
  @JsonValue('department')
  department('department'),
  @JsonValue('course')
  course('course'),
  @JsonValue('semester')
  semester('semester'),
  @JsonValue('exam_type')
  examType('exam_type'),

  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const MergedKind(this.json);

  factory MergedKind.fromJson(String json) =>
      values.firstWhere((e) => e.json == json, orElse: () => $unknown);

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();

  /// Returns all defined enum values excluding the $unknown value.
  static List<MergedKind> get $valuesDefined =>
      values.where((value) => value != $unknown).toList();
}
