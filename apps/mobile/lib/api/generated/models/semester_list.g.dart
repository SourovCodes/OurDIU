// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'semester_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SemesterList _$SemesterListFromJson(Map<String, dynamic> json) => SemesterList(
  items: (json['items'] as List<dynamic>)
      .map((e) => Semester.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$SemesterListToJson(SemesterList instance) =>
    <String, dynamic>{'items': instance.items};
