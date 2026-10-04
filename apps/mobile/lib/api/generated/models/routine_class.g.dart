// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_class.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineClass _$RoutineClassFromJson(Map<String, dynamic> json) => RoutineClass(
  day: RoutineDay.fromJson(json['day'] as String),
  start: json['start'] as String,
  end: json['end'] as String,
  course: RoutineCourse.fromJson(json['course'] as Map<String, dynamic>),
  labGroup: json['labGroup'] as String?,
  room: json['room'] as String,
  roomType: json['roomType'] == null
      ? null
      : RoutineRoomType.fromJson(json['roomType'] as String),
  teacher: json['teacher'] == null
      ? null
      : RoutineTeacher.fromJson(json['teacher'] as Map<String, dynamic>),
);

Map<String, dynamic> _$RoutineClassToJson(RoutineClass instance) =>
    <String, dynamic>{
      'day': _$RoutineDayEnumMap[instance.day]!,
      'start': instance.start,
      'end': instance.end,
      'course': instance.course,
      'labGroup': instance.labGroup,
      'room': instance.room,
      'roomType': _$RoutineRoomTypeEnumMap[instance.roomType],
      'teacher': instance.teacher,
    };

const _$RoutineDayEnumMap = {
  RoutineDay.sat: 'SAT',
  RoutineDay.sun: 'SUN',
  RoutineDay.mon: 'MON',
  RoutineDay.tue: 'TUE',
  RoutineDay.wed: 'WED',
  RoutineDay.thu: 'THU',
  RoutineDay.fri: 'FRI',
  RoutineDay.$unknown: r'$unknown',
};

const _$RoutineRoomTypeEnumMap = {
  RoutineRoomType.lab: 'lab',
  RoutineRoomType.$unknown: r'$unknown',
};
