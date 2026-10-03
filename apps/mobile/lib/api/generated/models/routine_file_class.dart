// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_day.dart';
import 'routine_file_class_room_type.dart';

part 'routine_file_class.g.dart';

@JsonSerializable()
class RoutineFileClass {
  const RoutineFileClass({
    required this.day,
    required this.start,
    required this.end,
    required this.course,
    required this.section,
    required this.room,
    this.labGroup,
    this.roomType,
    this.teacher,
  });

  factory RoutineFileClass.fromJson(Map<String, Object?> json) =>
      _$RoutineFileClassFromJson(json);

  final RoutineDay day;
  final String start;
  final String end;
  final String course;
  final String section;
  final String? labGroup;
  final String room;
  final RoutineFileClassRoomType? roomType;
  final String? teacher;

  Map<String, Object?> toJson() => _$RoutineFileClassToJson(this);
}
