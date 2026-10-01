// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'submission_counts.g.dart';

@JsonSerializable()
class SubmissionCounts {
  const SubmissionCounts({
    required this.published,
    required this.pendingReview,
    required this.rejected,
  });

  factory SubmissionCounts.fromJson(Map<String, Object?> json) =>
      _$SubmissionCountsFromJson(json);

  final int published;
  final int pendingReview;
  final int rejected;

  Map<String, Object?> toJson() => _$SubmissionCountsToJson(this);
}
