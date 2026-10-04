// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_attending_section.dart';
import 'routine_course.dart';
import 'routine_day.dart';
import 'routine_room_type.dart';

part 'routine_teacher_class.g.dart';

@JsonSerializable()
class RoutineTeacherClass {
  const RoutineTeacherClass({
    required this.day,
    required this.start,
    required this.end,
    required this.course,
    required this.room,
    required this.roomType,
    required this.sections,
  });

  factory RoutineTeacherClass.fromJson(Map<String, Object?> json) =>
      _$RoutineTeacherClassFromJson(json);

  final RoutineDay day;
  final String start;
  final String end;
  final RoutineCourse course;
  final String room;
  final RoutineRoomType? roomType;
  final List<RoutineAttendingSection> sections;

  Map<String, Object?> toJson() => _$RoutineTeacherClassToJson(this);
}
