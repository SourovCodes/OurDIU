// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'vote_value.dart';

part 'vote_result.g.dart';

@JsonSerializable()
class VoteResult {
  const VoteResult({
    required this.likeCount,
    required this.dislikeCount,
    required this.viewCount,
    required this.myVote,
  });

  factory VoteResult.fromJson(Map<String, Object?> json) =>
      _$VoteResultFromJson(json);

  final int likeCount;
  final int dislikeCount;
  final int viewCount;
  final VoteValue? myVote;

  Map<String, Object?> toJson() => _$VoteResultToJson(this);
}
