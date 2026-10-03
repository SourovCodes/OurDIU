// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_class.dart';
import 'routine_slot.dart';
import 'routine_version.dart';

part 'routine_section.g.dart';

@JsonSerializable()
class RoutineSection {
  const RoutineSection({
    required this.version,
    required this.section,
    required this.labGroups,
    required this.slots,
    required this.classes,
  });

  factory RoutineSection.fromJson(Map<String, Object?> json) =>
      _$RoutineSectionFromJson(json);

  final RoutineVersion version;
  final String section;
  final List<String> labGroups;
  final List<RoutineSlot> slots;
  final List<RoutineClass> classes;

  Map<String, Object?> toJson() => _$RoutineSectionToJson(this);
}
