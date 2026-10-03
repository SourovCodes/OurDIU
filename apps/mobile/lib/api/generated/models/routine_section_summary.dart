// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'routine_section_summary.g.dart';

@JsonSerializable()
class RoutineSectionSummary {
  const RoutineSectionSummary({
    required this.section,
    required this.labGroups,
    required this.classCount,
  });

  factory RoutineSectionSummary.fromJson(Map<String, Object?> json) =>
      _$RoutineSectionSummaryFromJson(json);

  final String section;
  final List<String> labGroups;
  final int classCount;

  Map<String, Object?> toJson() => _$RoutineSectionSummaryToJson(this);
}
