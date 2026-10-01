// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'cast_vote_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CastVoteInput _$CastVoteInputFromJson(Map<String, dynamic> json) =>
    CastVoteInput(value: VoteValue.fromJson((json['value'] as num).toInt()));

Map<String, dynamic> _$CastVoteInputToJson(CastVoteInput instance) =>
    <String, dynamic>{'value': _$VoteValueEnumMap[instance.value]!};

const _$VoteValueEnumMap = {
  VoteValue.value1: 1,
  VoteValue.valueMinus1: -1,
  VoteValue.$unknown: r'$unknown',
};
