// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'review_activity.g.dart';

@JsonSerializable()
class ReviewActivity {
  const ReviewActivity({required this.needsAttention});

  factory ReviewActivity.fromJson(Map<String, Object?> json) =>
      _$ReviewActivityFromJson(json);

  final int needsAttention;

  Map<String, Object?> toJson() => _$ReviewActivityToJson(this);
}
