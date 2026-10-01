// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'save_questions_input.g.dart';

@JsonSerializable()
class SaveQuestionsInput {
  const SaveQuestionsInput({required this.questionIds});

  factory SaveQuestionsInput.fromJson(Map<String, Object?> json) =>
      _$SaveQuestionsInputFromJson(json);

  final List<int> questionIds;

  Map<String, Object?> toJson() => _$SaveQuestionsInputToJson(this);
}
