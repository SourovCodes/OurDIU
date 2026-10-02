// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'review_author_role.dart';

part 'review_author.g.dart';

@JsonSerializable()
class ReviewAuthor {
  const ReviewAuthor({
    required this.role,
    required this.name,
    required this.image,
  });

  factory ReviewAuthor.fromJson(Map<String, Object?> json) =>
      _$ReviewAuthorFromJson(json);

  final ReviewAuthorRole role;
  final String? name;
  final String? image;

  Map<String, Object?> toJson() => _$ReviewAuthorToJson(this);
}
