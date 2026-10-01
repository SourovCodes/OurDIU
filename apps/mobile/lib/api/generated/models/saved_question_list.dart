// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'saved_question.dart';

part 'saved_question_list.g.dart';

@JsonSerializable()
class SavedQuestionList {
  const SavedQuestionList({required this.items});

  factory SavedQuestionList.fromJson(Map<String, Object?> json) =>
      _$SavedQuestionListFromJson(json);

  final List<SavedQuestion> items;

  Map<String, Object?> toJson() => _$SavedQuestionListToJson(this);
}
