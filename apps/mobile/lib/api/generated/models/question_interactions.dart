// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'question_vote.dart';

part 'question_interactions.g.dart';

@JsonSerializable()
class QuestionInteractions {
  const QuestionInteractions({
    required this.userId,
    required this.votes,
    required this.reportedSubmissionIds,
  });

  factory QuestionInteractions.fromJson(Map<String, Object?> json) =>
      _$QuestionInteractionsFromJson(json);

  final String userId;
  final List<QuestionVote> votes;
  final List<int> reportedSubmissionIds;

  Map<String, Object?> toJson() => _$QuestionInteractionsToJson(this);
}
