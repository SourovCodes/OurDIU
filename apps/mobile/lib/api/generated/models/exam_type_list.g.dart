// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'exam_type_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ExamTypeList _$ExamTypeListFromJson(Map<String, dynamic> json) => ExamTypeList(
  items: (json['items'] as List<dynamic>)
      .map((e) => ExamType.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$ExamTypeListToJson(ExamTypeList instance) =>
    <String, dynamic>{'items': instance.items};
