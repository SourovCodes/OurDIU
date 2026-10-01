// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'vote_value.dart';

part 'question_vote.g.dart';

@JsonSerializable()
class QuestionVote {
  const QuestionVote({required this.submissionId, required this.value});

  factory QuestionVote.fromJson(Map<String, Object?> json) =>
      _$QuestionVoteFromJson(json);

  final int submissionId;
  final VoteValue value;

  Map<String, Object?> toJson() => _$QuestionVoteToJson(this);
}
