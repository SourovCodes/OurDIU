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
);

Map<String, dynamic> _$AdminRoutineTeacherListToJson(
  AdminRoutineTeacherList instance,
) => <String, dynamic>{'items': instance.items};
