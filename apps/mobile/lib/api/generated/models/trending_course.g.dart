// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'trending_course.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TrendingCourse _$TrendingCourseFromJson(Map<String, dynamic> json) =>
    TrendingCourse(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      departmentId: (json['departmentId'] as num).toInt(),
      publishedCount: (json['publishedCount'] as num).toInt(),
      department: Department.fromJson(
        json['department'] as Map<String, dynamic>,
      ),
      viewsToday: (json['viewsToday'] as num).toInt(),
    );

Map<String, dynamic> _$TrendingCourseToJson(TrendingCourse instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'departmentId': instance.departmentId,
      'publishedCount': instance.publishedCount,
      'department': instance.department,
      'viewsToday': instance.viewsToday,
    };
