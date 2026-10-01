// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'analysis_flag.dart';
import 'analysis_status.dart';
import 'analysis_values.dart';

part 'uploader_analysis.g.dart';

@JsonSerializable()
class UploaderAnalysis {
  const UploaderAnalysis({
    required this.status,
    required this.requestedAt,
    required this.completedAt,
    required this.isQuestionPaper,
    required this.paperCount,
    required this.note,
    required this.flag,
    required this.values,
  });

  factory UploaderAnalysis.fromJson(Map<String, Object?> json) =>
      _$UploaderAnalysisFromJson(json);

  final AnalysisStatus status;
  final DateTime requestedAt;
  final DateTime? completedAt;
  final bool? isQuestionPaper;
  final int? paperCount;
  final String? note;
  final AnalysisFlag? flag;
  final AnalysisValues? values;

  Map<String, Object?> toJson() => _$UploaderAnalysisToJson(this);
}
