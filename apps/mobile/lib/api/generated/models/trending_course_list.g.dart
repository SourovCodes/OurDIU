// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'trending_course_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TrendingCourseList _$TrendingCourseListFromJson(Map<String, dynamic> json) =>
    TrendingCourseList(
      items: (json['items'] as List<dynamic>)
          .map((e) => TrendingCourse.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$TrendingCourseListToJson(TrendingCourseList instance) =>
    <String, dynamic>{'items': instance.items};
