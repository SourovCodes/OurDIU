// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'created_report.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreatedReport _$CreatedReportFromJson(Map<String, dynamic> json) =>
    CreatedReport(
      id: (json['id'] as num).toInt(),
      status: ReportStatus.fromJson(json['status'] as String),
      submissionHidden: json['submissionHidden'] as bool,
    );

Map<String, dynamic> _$CreatedReportToJson(CreatedReport instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': _$ReportStatusEnumMap[instance.status]!,
      'submissionHidden': instance.submissionHidden,
    };

const _$ReportStatusEnumMap = {
  ReportStatus.pending: 'pending',
  ReportStatus.resolved: 'resolved',
  ReportStatus.dismissed: 'dismissed',
  ReportStatus.$unknown: r'$unknown',
};
