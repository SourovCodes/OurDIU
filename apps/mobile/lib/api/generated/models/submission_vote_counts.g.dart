// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'submission_vote_counts.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SubmissionVoteCounts _$SubmissionVoteCountsFromJson(
  Map<String, dynamic> json,
) => SubmissionVoteCounts(
  submissionId: (json['submissionId'] as num).toInt(),
  likeCount: (json['likeCount'] as num).toInt(),
  dislikeCount: (json['dislikeCount'] as num).toInt(),
);

Map<String, dynamic> _$SubmissionVoteCountsToJson(
  SubmissionVoteCounts instance,
) => <String, dynamic>{
  'submissionId': instance.submissionId,
  'likeCount': instance.likeCount,
  'dislikeCount': instance.dislikeCount,
};
