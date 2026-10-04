// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_slot.dart';
import 'routine_teacher.dart';
import 'routine_teacher_class.dart';
import 'routine_version.dart';

part 'routine_teacher_week.g.dart';

@JsonSerializable()
class RoutineTeacherWeek {
  const RoutineTeacherWeek({
    required this.version,
    required this.teacher,
    required this.slots,
    required this.classes,
  });

  factory RoutineTeacherWeek.fromJson(Map<String, Object?> json) =>
      _$RoutineTeacherWeekFromJson(json);

  final RoutineVersion version;
  final RoutineTeacher teacher;
  final List<RoutineSlot> slots;
  final List<RoutineTeacherClass> classes;

  Map<String, Object?> toJson() => _$RoutineTeacherWeekToJson(this);
}
