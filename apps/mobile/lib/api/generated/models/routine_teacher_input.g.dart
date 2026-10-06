// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_teacher_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineTeacherInput _$RoutineTeacherInputFromJson(Map<String, dynamic> json) =>
    RoutineTeacherInput(
      name: json['name'] as String,
      designation: json['designation'] as String?,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      room: json['room'] as String?,
    );

Map<String, dynamic> _$RoutineTeacherInputToJson(
  RoutineTeacherInput instance,
) => <String, dynamic>{
  'name': instance.name,
  'designation': instance.designation,
  'phone': instance.phone,
  'email': instance.email,
  'room': instance.room,
};
