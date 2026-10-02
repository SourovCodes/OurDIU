// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'review_author.dart';
import 'review_message_kind.dart';

part 'review_message.g.dart';

@JsonSerializable()
class ReviewMessage {
  const ReviewMessage({
    required this.id,
    required this.kind,
    required this.body,
    required this.author,
    required this.createdAt,
  });

  factory ReviewMessage.fromJson(Map<String, Object?> json) =>
      _$ReviewMessageFromJson(json);

  final int id;
  final ReviewMessageKind kind;
  final String? body;
  final ReviewAuthor author;
  final DateTime createdAt;

  Map<String, Object?> toJson() => _$ReviewMessageToJson(this);
}
