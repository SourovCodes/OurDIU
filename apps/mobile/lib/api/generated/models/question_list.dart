// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'question.dart';

part 'question_list.g.dart';

@JsonSerializable()
class QuestionList {
  const QuestionList({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  factory QuestionList.fromJson(Map<String, Object?> json) =>
      _$QuestionListFromJson(json);

  final List<Question> items;
  final int page;
  final int pageSize;
  final int total;

  Map<String, Object?> toJson() => _$QuestionListToJson(this);
}
