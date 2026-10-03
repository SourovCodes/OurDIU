// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_changed_class.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineChangedClass _$RoutineChangedClassFromJson(Map<String, dynamic> json) =>
    RoutineChangedClass(
      day: RoutineDay.fromJson(json['day'] as String),
      start: json['start'] as String,
      end: json['end'] as String,
      course: json['course'] as String,
      labGroup: json['labGroup'] as String?,
      room: json['room'] as String,
      teacher: json['teacher'] as String?,
    );

Map<String, dynamic> _$RoutineChangedClassToJson(
  RoutineChangedClass instance,
) => <String, dynamic>{
  'day': _$RoutineDayEnumMap[instance.day]!,
  'start': instance.start,
  'end': instance.end,
  'course': instance.course,
  'labGroup': instance.labGroup,
  'room': instance.room,
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
