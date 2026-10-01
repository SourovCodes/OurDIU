// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'submission_classification.dart';
import 'submission_status.dart';

part 'contributor_submission.g.dart';

@JsonSerializable()
class ContributorSubmission {
  const ContributorSubmission({
    required this.likeCount,
    required this.dislikeCount,
    required this.viewCount,
    required this.id,
    required this.status,
    required this.fileSize,
    required this.createdAt,
    required this.section,
    required this.batch,
    required this.questionId,
    required this.classification,
  });

  factory ContributorSubmission.fromJson(Map<String, Object?> json) =>
      _$ContributorSubmissionFromJson(json);

  final int likeCount;
  final int dislikeCount;
  final int viewCount;
  final int id;
  final SubmissionStatus status;
  final int fileSize;
  final DateTime createdAt;
  final String? section;
  final String? batch;
  final int? questionId;
  final SubmissionClassification classification;

  Map<String, Object?> toJson() => _$ContributorSubmissionToJson(this);
}
