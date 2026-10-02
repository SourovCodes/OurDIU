// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'my_submission_detail.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MySubmissionDetail _$MySubmissionDetailFromJson(Map<String, dynamic> json) =>
    MySubmissionDetail(
      likeCount: (json['likeCount'] as num).toInt(),
      dislikeCount: (json['dislikeCount'] as num).toInt(),
      viewCount: (json['viewCount'] as num).toInt(),
      id: (json['id'] as num).toInt(),
      status: SubmissionStatus.fromJson(json['status'] as String),
      fileSize: (json['fileSize'] as num).toInt(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      section: json['section'] as String?,
      batch: json['batch'] as String?,
      questionId: (json['questionId'] as num?)?.toInt(),
      classification: SubmissionClassification.fromJson(
        json['classification'] as Map<String, dynamic>,
      ),
      autoPublished: json['autoPublished'] as bool,
      rejectionReason: json['rejectionReason'] as String?,
      changesRequested: json['changesRequested'] as String?,
      unread: (json['unread'] as num).toInt(),
      analysis: json['analysis'] == null
          ? null
          : AnalysisSummary.fromJson(json['analysis'] as Map<String, dynamic>),
      analysisDetail: json['analysisDetail'] == null
          ? null
          : UploaderAnalysis.fromJson(
              json['analysisDetail'] as Map<String, dynamic>,
            ),
      messages: (json['messages'] as List<dynamic>)
          .map((e) => ReviewMessage.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$MySubmissionDetailToJson(MySubmissionDetail instance) =>
    <String, dynamic>{
      'likeCount': instance.likeCount,
      'dislikeCount': instance.dislikeCount,
      'viewCount': instance.viewCount,
      'id': instance.id,
      'status': _$SubmissionStatusEnumMap[instance.status]!,
      'fileSize': instance.fileSize,
      'createdAt': instance.createdAt.toIso8601String(),
      'section': instance.section,
      'batch': instance.batch,
      'questionId': instance.questionId,
      'classification': instance.classification,
      'autoPublished': instance.autoPublished,
      'rejectionReason': instance.rejectionReason,
      'changesRequested': instance.changesRequested,
      'unread': instance.unread,
      'analysis': instance.analysis,
      'analysisDetail': instance.analysisDetail,
      'messages': instance.messages,
    };

const _$SubmissionStatusEnumMap = {
  SubmissionStatus.pendingReview: 'pending_review',
  SubmissionStatus.published: 'published',
  SubmissionStatus.rejected: 'rejected',
  SubmissionStatus.changesRequested: 'changes_requested',
  SubmissionStatus.$unknown: r'$unknown',
};
