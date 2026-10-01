// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'save_questions_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SaveQuestionsInput _$SaveQuestionsInputFromJson(Map<String, dynamic> json) =>
    SaveQuestionsInput(
      questionIds: (json['questionIds'] as List<dynamic>)
          .map((e) => (e as num).toInt())
          .toList(),
    );

Map<String, dynamic> _$SaveQuestionsInputToJson(SaveQuestionsInput instance) =>
    <String, dynamic>{'questionIds': instance.questionIds};
