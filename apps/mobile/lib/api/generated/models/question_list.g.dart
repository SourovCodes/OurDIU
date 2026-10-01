// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'question_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

QuestionList _$QuestionListFromJson(Map<String, dynamic> json) => QuestionList(
  items: (json['items'] as List<dynamic>)
      .map((e) => Question.fromJson(e as Map<String, dynamic>))
      .toList(),
  page: (json['page'] as num).toInt(),
  pageSize: (json['pageSize'] as num).toInt(),
  total: (json['total'] as num).toInt(),
);

Map<String, dynamic> _$QuestionListToJson(QuestionList instance) =>
    <String, dynamic>{
      'items': instance.items,
      'page': instance.page,
      'pageSize': instance.pageSize,
      'total': instance.total,
    };
