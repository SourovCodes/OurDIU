// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'report_reason.dart';

part 'create_report_input.g.dart';

@JsonSerializable()
class CreateReportInput {
  const CreateReportInput({required this.reason, this.details});

  factory CreateReportInput.fromJson(Map<String, Object?> json) =>
      _$CreateReportInputFromJson(json);

  final ReportReason reason;
  final String? details;

  Map<String, Object?> toJson() => _$CreateReportInputToJson(this);
}
