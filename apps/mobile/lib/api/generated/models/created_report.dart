// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'report_status.dart';

part 'created_report.g.dart';

@JsonSerializable()
class CreatedReport {
  const CreatedReport({
    required this.id,
    required this.status,
    required this.submissionHidden,
  });

  factory CreatedReport.fromJson(Map<String, Object?> json) =>
      _$CreatedReportFromJson(json);

  final int id;
  final ReportStatus status;
  final bool submissionHidden;

  Map<String, Object?> toJson() => _$CreatedReportToJson(this);
}
