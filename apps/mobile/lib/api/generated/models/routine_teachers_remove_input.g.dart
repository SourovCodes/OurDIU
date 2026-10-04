// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_teachers_remove_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineTeachersRemoveInput _$RoutineTeachersRemoveInputFromJson(
  Map<String, dynamic> json,
) => RoutineTeachersRemoveInput(
  department: RoutineDepartment.fromJson(json['department'] as String),
  initials: (json['initials'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
);

Map<String, dynamic> _$RoutineTeachersRemoveInputToJson(
  RoutineTeachersRemoveInput instance,
) => <String, dynamic>{
  'department': _$RoutineDepartmentEnumMap[instance.department]!,
  'initials': instance.initials,
};

const _$RoutineDepartmentEnumMap = {
  RoutineDepartment.cse: 'CSE',
  RoutineDepartment.eee: 'EEE',
  RoutineDepartment.swe: 'SWE',
  RoutineDepartment.$unknown: r'$unknown',
};
