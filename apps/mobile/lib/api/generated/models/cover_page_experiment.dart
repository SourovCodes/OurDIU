// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'cover_page_experiment.g.dart';

@JsonSerializable()
class CoverPageExperiment {
  const CoverPageExperiment({
    required this.no,
    required this.name,
    required this.performedOn,
    required this.submittedOn,
  });

  factory CoverPageExperiment.fromJson(Map<String, Object?> json) =>
      _$CoverPageExperimentFromJson(json);

  final String no;
  final String name;
  final String performedOn;
  final String submittedOn;

  Map<String, Object?> toJson() => _$CoverPageExperimentToJson(this);
}
