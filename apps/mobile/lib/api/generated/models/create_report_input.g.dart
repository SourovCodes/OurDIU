// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_report_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateReportInput _$CreateReportInputFromJson(Map<String, dynamic> json) =>
    CreateReportInput(
      reason: ReportReason.fromJson(json['reason'] as String),
      details: json['details'] as String?,
    );

Map<String, dynamic> _$CreateReportInputToJson(CreateReportInput instance) =>
    <String, dynamic>{
      'reason': _$ReportReasonEnumMap[instance.reason]!,
      'details': instance.details,
    };

const _$ReportReasonEnumMap = {
  ReportReason.wrongDetails: 'wrong_details',
  ReportReason.wrongFile: 'wrong_file',
  ReportReason.unreadable: 'unreadable',
  ReportReason.duplicate: 'duplicate',
  ReportReason.inappropriate: 'inappropriate',
  ReportReason.other: 'other',
  ReportReason.$unknown: r'$unknown',
};
