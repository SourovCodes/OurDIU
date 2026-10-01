// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'submission_counts.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SubmissionCounts _$SubmissionCountsFromJson(Map<String, dynamic> json) =>
    SubmissionCounts(
      published: (json['published'] as num).toInt(),
      pendingReview: (json['pendingReview'] as num).toInt(),
      rejected: (json['rejected'] as num).toInt(),
    );

Map<String, dynamic> _$SubmissionCountsToJson(SubmissionCounts instance) =>
    <String, dynamic>{
      'published': instance.published,
      'pendingReview': instance.pendingReview,
      'rejected': instance.rejected,
    };
