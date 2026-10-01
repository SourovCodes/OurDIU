// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'saved_question_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SavedQuestionList _$SavedQuestionListFromJson(Map<String, dynamic> json) =>
    SavedQuestionList(
      items: (json['items'] as List<dynamic>)
          .map((e) => SavedQuestion.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$SavedQuestionListToJson(SavedQuestionList instance) =>
    <String, dynamic>{'items': instance.items};
