// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_teacher_summary.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineTeacherSummary _$RoutineTeacherSummaryFromJson(
  Map<String, dynamic> json,
) => RoutineTeacherSummary(
  initials: json['initials'] as String,
  name: json['name'] as String?,
  courses: (json['courses'] as List<dynamic>).map((e) => e as String).toList(),
  classCount: (json['classCount'] as num).toInt(),
);

Map<String, dynamic> _$RoutineTeacherSummaryToJson(
  RoutineTeacherSummary instance,
) => <String, dynamic>{
  'initials': instance.initials,
  'name': instance.name,
  'courses': instance.courses,
  'classCount': instance.classCount,
};
