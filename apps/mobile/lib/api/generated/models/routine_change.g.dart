// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_change.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineChange _$RoutineChangeFromJson(Map<String, dynamic> json) =>
    RoutineChange(
      section: json['section'] as String,
      kind: RoutineChangeKind.fromJson(json['kind'] as String),
      before: json['before'] == null
          ? null
          : RoutineChangedClass.fromJson(
              json['before'] as Map<String, dynamic>,
            ),
      after: json['after'] == null
          ? null
          : RoutineChangedClass.fromJson(json['after'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$RoutineChangeToJson(RoutineChange instance) =>
    <String, dynamic>{
      'section': instance.section,
      'kind': _$RoutineChangeKindEnumMap[instance.kind]!,
      'before': instance.before,
      'after': instance.after,
    };

const _$RoutineChangeKindEnumMap = {
  RoutineChangeKind.moved: 'moved',
  RoutineChangeKind.room: 'room',
  RoutineChangeKind.teacher: 'teacher',
  RoutineChangeKind.added: 'added',
  RoutineChangeKind.removed: 'removed',
  RoutineChangeKind.$unknown: r'$unknown',
};
