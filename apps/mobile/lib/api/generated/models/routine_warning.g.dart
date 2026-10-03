// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_warning.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineWarning _$RoutineWarningFromJson(Map<String, dynamic> json) =>
    RoutineWarning(
      kind: RoutineWarningKind.fromJson(json['kind'] as String),
      message: json['message'] as String,
    );

Map<String, dynamic> _$RoutineWarningToJson(RoutineWarning instance) =>
    <String, dynamic>{
      'kind': _$RoutineWarningKindEnumMap[instance.kind]!,
      'message': instance.message,
    };

const _$RoutineWarningKindEnumMap = {
  RoutineWarningKind.sectionClash: 'section_clash',
  RoutineWarningKind.roomClash: 'room_clash',
  RoutineWarningKind.teacherClash: 'teacher_clash',
  RoutineWarningKind.duplicate: 'duplicate',
  RoutineWarningKind.untitledCourse: 'untitled_course',
  RoutineWarningKind.$unknown: r'$unknown',
};
