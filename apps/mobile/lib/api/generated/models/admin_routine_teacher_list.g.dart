// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_routine_teacher_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AdminRoutineTeacherList _$AdminRoutineTeacherListFromJson(
  Map<String, dynamic> json,
) => AdminRoutineTeacherList(
  items: (json['items'] as List<dynamic>)
      .map((e) => AdminRoutineTeacher.fromJson(e as Map<String, dynamic>))
      .toList(),
  page: (json['page'] as num).toInt(),
  pageSize: (json['pageSize'] as num).toInt(),
  total: (json['total'] as num).toInt(),
  all: (json['all'] as num).toInt(),
  named: (json['named'] as num).toInt(),
  version: json['version'] as String?,
);

Map<String, dynamic> _$AdminRoutineTeacherListToJson(
  AdminRoutineTeacherList instance,
) => <String, dynamic>{
  'items': instance.items,
  'page': instance.page,
  'pageSize': instance.pageSize,
  'total': instance.total,
  'all': instance.all,
  'named': instance.named,
  'version': instance.version,
};
