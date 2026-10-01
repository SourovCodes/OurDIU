// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'uploader_analysis.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UploaderAnalysis _$UploaderAnalysisFromJson(Map<String, dynamic> json) =>
    UploaderAnalysis(
      status: AnalysisStatus.fromJson(json['status'] as String),
      requestedAt: DateTime.parse(json['requestedAt'] as String),
      completedAt: json['completedAt'] == null
          ? null
          : DateTime.parse(json['completedAt'] as String),
      isQuestionPaper: json['isQuestionPaper'] as bool?,
      paperCount: (json['paperCount'] as num?)?.toInt(),
      note: json['note'] as String?,
      flag: json['flag'] == null
          ? null
          : AnalysisFlag.fromJson(json['flag'] as String),
      values: json['values'] == null
          ? null
          : AnalysisValues.fromJson(json['values'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$UploaderAnalysisToJson(UploaderAnalysis instance) =>
    <String, dynamic>{
      'status': _$AnalysisStatusEnumMap[instance.status]!,
      'requestedAt': instance.requestedAt.toIso8601String(),
      'completedAt': instance.completedAt?.toIso8601String(),
      'isQuestionPaper': instance.isQuestionPaper,
      'paperCount': instance.paperCount,
      'note': instance.note,
      'flag': _$AnalysisFlagEnumMap[instance.flag],
      'values': instance.values,
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
