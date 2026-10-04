// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_courses_remove_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineCoursesRemoveInput _$RoutineCoursesRemoveInputFromJson(
  Map<String, dynamic> json,
) => RoutineCoursesRemoveInput(
  department: RoutineDepartment.fromJson(json['department'] as String),
  codes: (json['codes'] as List<dynamic>).map((e) => e as String).toList(),
);

Map<String, dynamic> _$RoutineCoursesRemoveInputToJson(
  RoutineCoursesRemoveInput instance,
) => <String, dynamic>{
  'department': _$RoutineDepartmentEnumMap[instance.department]!,
  'codes': instance.codes,
};

const _$RoutineDepartmentEnumMap = {
  RoutineDepartment.cse: 'CSE',
  RoutineDepartment.eee: 'EEE',
  RoutineDepartment.$unknown: r'$unknown',
};
