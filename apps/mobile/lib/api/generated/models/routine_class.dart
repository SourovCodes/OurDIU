// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_course.dart';
import 'routine_day.dart';
import 'routine_room_type.dart';
import 'routine_teacher.dart';

part 'routine_class.g.dart';

@JsonSerializable()
class RoutineClass {
  const RoutineClass({
    required this.day,
    required this.start,
    required this.end,
    required this.course,
    required this.labGroup,
    required this.room,
    required this.roomType,
    required this.teacher,
  });

  factory RoutineClass.fromJson(Map<String, Object?> json) =>
      _$RoutineClassFromJson(json);

  final RoutineDay day;
  final String start;
  final String end;
  final RoutineCourse course;
  final String? labGroup;
  final String room;
  final RoutineRoomType? roomType;
  final RoutineTeacher? teacher;

  Map<String, Object?> toJson() => _$RoutineClassToJson(this);
}
