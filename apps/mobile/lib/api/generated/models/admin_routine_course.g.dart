// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_routine_course.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AdminRoutineCourse _$AdminRoutineCourseFromJson(Map<String, dynamic> json) =>
    AdminRoutineCourse(
      department: RoutineDepartment.fromJson(json['department'] as String),
      code: json['code'] as String,
      title: json['title'] as String?,
      liveSections: (json['liveSections'] as num).toInt(),
    );

Map<String, dynamic> _$AdminRoutineCourseToJson(AdminRoutineCourse instance) =>
    <String, dynamic>{
      'department': _$RoutineDepartmentEnumMap[instance.department]!,
      'code': instance.code,
      'title': instance.title,
      'liveSections': instance.liveSections,
    };

const _$RoutineDepartmentEnumMap = {
  RoutineDepartment.cse: 'CSE',
  RoutineDepartment.eee: 'EEE',
  RoutineDepartment.$unknown: r'$unknown',
};
