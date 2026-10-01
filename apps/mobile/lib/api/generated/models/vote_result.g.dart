// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'vote_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VoteResult _$VoteResultFromJson(Map<String, dynamic> json) => VoteResult(
  likeCount: (json['likeCount'] as num).toInt(),
  dislikeCount: (json['dislikeCount'] as num).toInt(),
  viewCount: (json['viewCount'] as num).toInt(),
  myVote: json['myVote'] == null
      ? null
      : VoteValue.fromJson((json['myVote'] as num).toInt()),
);

Map<String, dynamic> _$VoteResultToJson(VoteResult instance) =>
    <String, dynamic>{
      'likeCount': instance.likeCount,
      'dislikeCount': instance.dislikeCount,
      'viewCount': instance.viewCount,
      'myVote': _$VoteValueEnumMap[instance.myVote],
    };

const _$VoteValueEnumMap = {
  VoteValue.value1: 1,
  VoteValue.valueMinus1: -1,
  VoteValue.$unknown: r'$unknown',
};
