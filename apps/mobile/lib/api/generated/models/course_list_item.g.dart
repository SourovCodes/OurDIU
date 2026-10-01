// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'course_list_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CourseListItem _$CourseListItemFromJson(Map<String, dynamic> json) =>
    CourseListItem(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      departmentId: (json['departmentId'] as num).toInt(),
      publishedCount: (json['publishedCount'] as num).toInt(),
    );

Map<String, dynamic> _$CourseListItemToJson(CourseListItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'departmentId': instance.departmentId,
      'publishedCount': instance.publishedCount,
    };
