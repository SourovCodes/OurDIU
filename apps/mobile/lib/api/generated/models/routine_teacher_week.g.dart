// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_teacher_week.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineTeacherWeek _$RoutineTeacherWeekFromJson(Map<String, dynamic> json) =>
    RoutineTeacherWeek(
      version: RoutineVersion.fromJson(json['version'] as Map<String, dynamic>),
      teacher: RoutineTeacher.fromJson(json['teacher'] as Map<String, dynamic>),
      slots: (json['slots'] as List<dynamic>)
          .map((e) => RoutineSlot.fromJson(e as Map<String, dynamic>))
          .toList(),
      classes: (json['classes'] as List<dynamic>)
          .map((e) => RoutineTeacherClass.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$RoutineTeacherWeekToJson(RoutineTeacherWeek instance) =>
    <String, dynamic>{
      'version': instance.version,
      'teacher': instance.teacher,
      'slots': instance.slots,
      'classes': instance.classes,
    };
