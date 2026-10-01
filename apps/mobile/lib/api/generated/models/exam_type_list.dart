// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'exam_type.dart';

part 'exam_type_list.g.dart';

@JsonSerializable()
class ExamTypeList {
  const ExamTypeList({required this.items});

  factory ExamTypeList.fromJson(Map<String, Object?> json) =>
      _$ExamTypeListFromJson(json);

  final List<ExamType> items;

  Map<String, Object?> toJson() => _$ExamTypeListToJson(this);
}
