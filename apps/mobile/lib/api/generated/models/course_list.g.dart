// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'course_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CourseList _$CourseListFromJson(Map<String, dynamic> json) => CourseList(
  items: (json['items'] as List<dynamic>)
      .map((e) => CourseListItem.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$CourseListToJson(CourseList instance) =>
    <String, dynamic>{'items': instance.items};
