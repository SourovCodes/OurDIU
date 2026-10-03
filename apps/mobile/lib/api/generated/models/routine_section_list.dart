// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_section_summary.dart';
import 'routine_version.dart';

part 'routine_section_list.g.dart';

@JsonSerializable()
class RoutineSectionList {
  const RoutineSectionList({required this.version, required this.sections});

  factory RoutineSectionList.fromJson(Map<String, Object?> json) =>
      _$RoutineSectionListFromJson(json);

  final RoutineVersion version;
  final List<RoutineSectionSummary> sections;

  Map<String, Object?> toJson() => _$RoutineSectionListToJson(this);
}
