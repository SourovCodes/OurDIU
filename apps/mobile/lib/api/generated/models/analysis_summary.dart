// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'analysis_flag.dart';
import 'analysis_status.dart';

part 'analysis_summary.g.dart';

@JsonSerializable()
class AnalysisSummary {
  const AnalysisSummary({
    required this.status,
    required this.flag,
    required this.matches,
  });

  factory AnalysisSummary.fromJson(Map<String, Object?> json) =>
      _$AnalysisSummaryFromJson(json);

  final AnalysisStatus status;
  final AnalysisFlag? flag;
  final bool? matches;

  Map<String, Object?> toJson() => _$AnalysisSummaryToJson(this);
}
