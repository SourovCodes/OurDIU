// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'created_submission.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreatedSubmission _$CreatedSubmissionFromJson(Map<String, dynamic> json) =>
    CreatedSubmission(
      id: (json['id'] as num).toInt(),
      status: SubmissionStatus.fromJson(json['status'] as String),
      questionId: (json['questionId'] as num?)?.toInt(),
    );

Map<String, dynamic> _$CreatedSubmissionToJson(CreatedSubmission instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': _$SubmissionStatusEnumMap[instance.status]!,
      'questionId': instance.questionId,
    };

const _$SubmissionStatusEnumMap = {
  SubmissionStatus.pendingReview: 'pending_review',
  SubmissionStatus.published: 'published',
  SubmissionStatus.rejected: 'rejected',
  SubmissionStatus.$unknown: r'$unknown',
};
