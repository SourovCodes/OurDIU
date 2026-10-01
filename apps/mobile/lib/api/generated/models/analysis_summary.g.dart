// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'analysis_summary.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AnalysisSummary _$AnalysisSummaryFromJson(Map<String, dynamic> json) =>
    AnalysisSummary(
      status: AnalysisStatus.fromJson(json['status'] as String),
      flag: json['flag'] == null
          ? null
          : AnalysisFlag.fromJson(json['flag'] as String),
      matches: json['matches'] as bool?,
    );

Map<String, dynamic> _$AnalysisSummaryToJson(AnalysisSummary instance) =>
    <String, dynamic>{
      'status': _$AnalysisStatusEnumMap[instance.status]!,
      'flag': _$AnalysisFlagEnumMap[instance.flag],
      'matches': instance.matches,
    };

const _$AnalysisStatusEnumMap = {
  AnalysisStatus.queued: 'queued',
  AnalysisStatus.processing: 'processing',
  AnalysisStatus.completed: 'completed',
  AnalysisStatus.failed: 'failed',
  AnalysisStatus.$unknown: r'$unknown',
};

const _$AnalysisFlagEnumMap = {
  AnalysisFlag.notAPaper: 'not_a_paper',
  AnalysisFlag.multiplePapers: 'multiple_papers',
  AnalysisFlag.$unknown: r'$unknown',
};
