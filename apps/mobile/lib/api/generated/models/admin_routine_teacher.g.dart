// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_routine_teacher.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AdminRoutineTeacher _$AdminRoutineTeacherFromJson(Map<String, dynamic> json) =>
    AdminRoutineTeacher(
      department: RoutineDepartment.fromJson(json['department'] as String),
      initials: json['initials'] as String,
      name: json['name'] as String?,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      room: json['room'] as String?,
      liveClasses: (json['liveClasses'] as num).toInt(),
    );

Map<String, dynamic> _$AdminRoutineTeacherToJson(
  AdminRoutineTeacher instance,
) => <String, dynamic>{
  'department': _$RoutineDepartmentEnumMap[instance.department]!,
  'initials': instance.initials,
  'name': instance.name,
  'phone': instance.phone,
  'email': instance.email,
  'room': instance.room,
  'liveClasses': instance.liveClasses,
};

const _$RoutineDepartmentEnumMap = {
  RoutineDepartment.cse: 'CSE',
  RoutineDepartment.eee: 'EEE',
  RoutineDepartment.$unknown: r'$unknown',
};
