// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'semester.g.dart';

@JsonSerializable()
class Semester {
  const Semester({required this.id, required this.name});

  factory Semester.fromJson(Map<String, Object?> json) =>
      _$SemesterFromJson(json);

  final int id;
  final String name;

  Map<String, Object?> toJson() => _$SemesterToJson(this);
}
