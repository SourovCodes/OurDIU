// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'routine_attending_section.g.dart';

@JsonSerializable()
class RoutineAttendingSection {
  const RoutineAttendingSection({
    required this.section,
    required this.labGroup,
  });

  factory RoutineAttendingSection.fromJson(Map<String, Object?> json) =>
      _$RoutineAttendingSectionFromJson(json);

  final String section;
  final String? labGroup;

  Map<String, Object?> toJson() => _$RoutineAttendingSectionToJson(this);
}
