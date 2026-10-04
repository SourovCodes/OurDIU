// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_teacher_class.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineTeacherClass _$RoutineTeacherClassFromJson(Map<String, dynamic> json) =>
    RoutineTeacherClass(
      day: RoutineDay.fromJson(json['day'] as String),
      start: json['start'] as String,
      end: json['end'] as String,
      course: RoutineCourse.fromJson(json['course'] as Map<String, dynamic>),
      room: json['room'] as String,
      roomType: json['roomType'] == null
          ? null
          : RoutineRoomType.fromJson(json['roomType'] as String),
      sections: (json['sections'] as List<dynamic>)
          .map(
            (e) => RoutineAttendingSection.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    );

Map<String, dynamic> _$RoutineTeacherClassToJson(
  RoutineTeacherClass instance,
) => <String, dynamic>{
  'day': _$RoutineDayEnumMap[instance.day]!,
  'start': instance.start,
  'end': instance.end,
  'course': instance.course,
  'room': instance.room,
  'roomType': _$RoutineRoomTypeEnumMap[instance.roomType],
  'sections': instance.sections,
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
