// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'question_vote.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

QuestionVote _$QuestionVoteFromJson(Map<String, dynamic> json) => QuestionVote(
  submissionId: (json['submissionId'] as num).toInt(),
  value: VoteValue.fromJson((json['value'] as num).toInt()),
);

Map<String, dynamic> _$QuestionVoteToJson(QuestionVote instance) =>
    <String, dynamic>{
      'submissionId': instance.submissionId,
      'value': _$VoteValueEnumMap[instance.value]!,
    };

const _$VoteValueEnumMap = {
  VoteValue.value1: 1,
  VoteValue.valueMinus1: -1,
  VoteValue.$unknown: r'$unknown',
};
