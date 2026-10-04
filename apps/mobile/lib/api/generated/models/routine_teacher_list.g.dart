// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_teacher_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineTeacherList _$RoutineTeacherListFromJson(Map<String, dynamic> json) =>
    RoutineTeacherList(
      version: RoutineVersion.fromJson(json['version'] as Map<String, dynamic>),
      teachers: (json['teachers'] as List<dynamic>)
          .map((e) => RoutineTeacherSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$RoutineTeacherListToJson(RoutineTeacherList instance) =>
    <String, dynamic>{
      'version': instance.version,
      'teachers': instance.teachers,
    };
