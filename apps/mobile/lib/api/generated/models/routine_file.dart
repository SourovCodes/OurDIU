// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_department.dart';
import 'routine_file_class.dart';
import 'routine_file_format.dart';
import 'routine_slot.dart';

part 'routine_file.g.dart';

@JsonSerializable()
class RoutineFile {
  const RoutineFile({
    required this.format,
    required this.department,
    required this.version,
    required this.slots,
    required this.classes,
    this.publishedOn,
    this.source,
    this.courses,
    this.teachers,
  });

  factory RoutineFile.fromJson(Map<String, Object?> json) =>
      _$RoutineFileFromJson(json);

  final RoutineFileFormat format;
  final RoutineDepartment department;
  final String version;
  final DateTime? publishedOn;
  final String? source;
  final List<RoutineSlot> slots;
  final Map<String, String>? courses;
  final Map<String, String>? teachers;
  final List<RoutineFileClass> classes;

  Map<String, Object?> toJson() => _$RoutineFileToJson(this);
}
