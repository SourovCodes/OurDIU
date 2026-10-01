// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'exam_type.g.dart';

@JsonSerializable()
class ExamType {
  const ExamType({required this.id, required this.name});

  factory ExamType.fromJson(Map<String, Object?> json) =>
      _$ExamTypeFromJson(json);

  final int id;
  final String name;

  Map<String, Object?> toJson() => _$ExamTypeToJson(this);
}
