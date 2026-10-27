// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'question_interactions.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

QuestionInteractions _$QuestionInteractionsFromJson(
  Map<String, dynamic> json,
) => QuestionInteractions(
  userId: json['userId'] as String,
  votes: (json['votes'] as List<dynamic>)
      .map((e) => QuestionVote.fromJson(e as Map<String, dynamic>))
      .toList(),
  reportedSubmissionIds: (json['reportedSubmissionIds'] as List<dynamic>)
      .map((e) => (e as num).toInt())
      .toList(),
  saved: json['saved'] as bool,
);

Map<String, dynamic> _$QuestionInteractionsToJson(
  QuestionInteractions instance,
) => <String, dynamic>{
  'userId': instance.userId,
  'votes': instance.votes,
  'reportedSubmissionIds': instance.reportedSubmissionIds,
  'saved': instance.saved,
};
