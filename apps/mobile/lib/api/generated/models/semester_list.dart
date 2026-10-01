// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'semester.dart';

part 'semester_list.g.dart';

@JsonSerializable()
class SemesterList {
  const SemesterList({required this.items});

  factory SemesterList.fromJson(Map<String, Object?> json) =>
      _$SemesterListFromJson(json);

  final List<Semester> items;

  Map<String, Object?> toJson() => _$SemesterListToJson(this);
}
