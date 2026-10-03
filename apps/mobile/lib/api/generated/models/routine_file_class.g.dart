// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_file_class.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineFileClass _$RoutineFileClassFromJson(Map<String, dynamic> json) =>
    RoutineFileClass(
      day: RoutineDay.fromJson(json['day'] as String),
      start: json['start'] as String,
      end: json['end'] as String,
      course: json['course'] as String,
      section: json['section'] as String,
      room: json['room'] as String,
      labGroup: json['labGroup'] as String?,
      roomType: json['roomType'] == null
          ? null
          : RoutineFileClassRoomType.fromJson(json['roomType'] as String?),
      teacher: json['teacher'] as String?,
    );

Map<String, dynamic> _$RoutineFileClassToJson(RoutineFileClass instance) =>
    <String, dynamic>{
      'day': _$RoutineDayEnumMap[instance.day]!,
      'start': instance.start,
      'end': instance.end,
      'course': instance.course,
      'section': instance.section,
      'labGroup': instance.labGroup,
      'room': instance.room,
      'roomType': _$RoutineFileClassRoomTypeEnumMap[instance.roomType],
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

const _$RoutineFileClassRoomTypeEnumMap = {
  RoutineFileClassRoomType.lab: 'lab',
  RoutineFileClassRoomType.valueNull: null,
  RoutineFileClassRoomType.$unknown: r'$unknown',
};
