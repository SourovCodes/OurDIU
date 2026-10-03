// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_day.dart';

part 'routine_changed_class.g.dart';

@JsonSerializable()
class RoutineChangedClass {
  const RoutineChangedClass({
    required this.day,
    required this.start,
    required this.end,
    required this.course,
    required this.labGroup,
    required this.room,
    required this.teacher,
  });

  factory RoutineChangedClass.fromJson(Map<String, Object?> json) =>
      _$RoutineChangedClassFromJson(json);

  final RoutineDay day;
  final String start;
  final String end;
  final String course;
  final String? labGroup;
  final String room;
  final String? teacher;

  Map<String, Object?> toJson() => _$RoutineChangedClassToJson(this);
}
