// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'post_review_message_input.g.dart';

@JsonSerializable()
class PostReviewMessageInput {
  const PostReviewMessageInput({required this.body});

  factory PostReviewMessageInput.fromJson(Map<String, Object?> json) =>
      _$PostReviewMessageInputFromJson(json);

  final String body;

  Map<String, Object?> toJson() => _$PostReviewMessageInputToJson(this);
}
