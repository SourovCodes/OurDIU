// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_routine_course_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AdminRoutineCourseList _$AdminRoutineCourseListFromJson(
  Map<String, dynamic> json,
) => AdminRoutineCourseList(
  items: (json['items'] as List<dynamic>)
      .map((e) => AdminRoutineCourse.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$AdminRoutineCourseListToJson(
  AdminRoutineCourseList instance,
) => <String, dynamic>{'items': instance.items};
