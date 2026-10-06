// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_teacher.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineTeacher _$RoutineTeacherFromJson(Map<String, dynamic> json) =>
    RoutineTeacher(
      initials: json['initials'] as String,
      name: json['name'] as String?,
      designation: json['designation'] as String?,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      room: json['room'] as String?,
    );

Map<String, dynamic> _$RoutineTeacherToJson(RoutineTeacher instance) =>
    <String, dynamic>{
      'initials': instance.initials,
      'name': instance.name,
      'designation': instance.designation,
      'phone': instance.phone,
      'email': instance.email,
      'room': instance.room,
    };
