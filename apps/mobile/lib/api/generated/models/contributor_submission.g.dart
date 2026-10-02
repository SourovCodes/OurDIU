// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'contributor_submission.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ContributorSubmission _$ContributorSubmissionFromJson(
  Map<String, dynamic> json,
) => ContributorSubmission(
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
);

Map<String, dynamic> _$ContributorSubmissionToJson(
  ContributorSubmission instance,
) => <String, dynamic>{
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
};

const _$SubmissionStatusEnumMap = {
  SubmissionStatus.pendingReview: 'pending_review',
  SubmissionStatus.published: 'published',
  SubmissionStatus.rejected: 'rejected',
  SubmissionStatus.changesRequested: 'changes_requested',
  SubmissionStatus.$unknown: r'$unknown',
};
