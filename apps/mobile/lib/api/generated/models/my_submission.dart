// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'analysis_summary.dart';
import 'submission_classification.dart';
import 'submission_status.dart';

part 'my_submission.g.dart';

@JsonSerializable()
class MySubmission {
  const MySubmission({
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
    required this.autoPublished,
    required this.rejectionReason,
    required this.analysis,
  });

  factory MySubmission.fromJson(Map<String, Object?> json) =>
      _$MySubmissionFromJson(json);

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
  final bool autoPublished;
  final String? rejectionReason;
  final AnalysisSummary? analysis;

  Map<String, Object?> toJson() => _$MySubmissionToJson(this);
}
