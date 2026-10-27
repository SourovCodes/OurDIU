// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'submission_vote_counts.g.dart';

@JsonSerializable()
class SubmissionVoteCounts {
  const SubmissionVoteCounts({
    required this.submissionId,
    required this.likeCount,
    required this.dislikeCount,
  });

  factory SubmissionVoteCounts.fromJson(Map<String, Object?> json) =>
      _$SubmissionVoteCountsFromJson(json);

  final int submissionId;
  final int likeCount;
  final int dislikeCount;

  Map<String, Object?> toJson() => _$SubmissionVoteCountsToJson(this);
}
