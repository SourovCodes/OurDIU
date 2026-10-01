// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'vote_value.dart';

part 'cast_vote_input.g.dart';

@JsonSerializable()
class CastVoteInput {
  const CastVoteInput({required this.value});

  factory CastVoteInput.fromJson(Map<String, Object?> json) =>
      _$CastVoteInputFromJson(json);

  final VoteValue value;

  Map<String, Object?> toJson() => _$CastVoteInputToJson(this);
}
