// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'submission.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Submission _$SubmissionFromJson(Map<String, dynamic> json) => Submission(
  likeCount: (json['likeCount'] as num).toInt(),
  dislikeCount: (json['dislikeCount'] as num).toInt(),
  viewCount: (json['viewCount'] as num).toInt(),
  id: (json['id'] as num).toInt(),
  status: SubmissionStatus.fromJson(json['status'] as String),
  fileSize: (json['fileSize'] as num).toInt(),
  createdAt: DateTime.parse(json['createdAt'] as String),
  section: json['section'] as String?,
  batch: json['batch'] as String?,
  uploader: json['uploader'] == null
      ? null
      : Uploader.fromJson(json['uploader'] as Map<String, dynamic>),
  fileUrl: json['fileUrl'] as String?,
);

Map<String, dynamic> _$SubmissionToJson(Submission instance) =>
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
      'uploader': instance.uploader,
      'fileUrl': instance.fileUrl,
    };

const _$SubmissionStatusEnumMap = {
  SubmissionStatus.pendingReview: 'pending_review',
  SubmissionStatus.published: 'published',
  SubmissionStatus.rejected: 'rejected',
  SubmissionStatus.$unknown: r'$unknown',
};
