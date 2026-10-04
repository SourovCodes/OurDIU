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
  page: (json['page'] as num).toInt(),
  pageSize: (json['pageSize'] as num).toInt(),
  total: (json['total'] as num).toInt(),
  all: (json['all'] as num).toInt(),
  titled: (json['titled'] as num).toInt(),
  version: json['version'] as String?,
);

Map<String, dynamic> _$AdminRoutineCourseListToJson(
  AdminRoutineCourseList instance,
) => <String, dynamic>{
  'items': instance.items,
  'page': instance.page,
  'pageSize': instance.pageSize,
  'total': instance.total,
  'all': instance.all,
  'titled': instance.titled,
  'version': instance.version,
};
