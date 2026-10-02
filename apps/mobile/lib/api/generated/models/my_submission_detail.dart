// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'analysis_summary.dart';
import 'review_message.dart';
import 'submission_classification.dart';
import 'submission_status.dart';
import 'uploader_analysis.dart';

part 'my_submission_detail.g.dart';

@JsonSerializable()
class MySubmissionDetail {
  const MySubmissionDetail({
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
    required this.changesRequested,
    required this.unread,
    required this.analysis,
    required this.analysisDetail,
    required this.messages,
  });

  factory MySubmissionDetail.fromJson(Map<String, Object?> json) =>
      _$MySubmissionDetailFromJson(json);

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
  final String? changesRequested;
  final int unread;
  final AnalysisSummary? analysis;
  final UploaderAnalysis? analysisDetail;
  final List<ReviewMessage> messages;

  Map<String, Object?> toJson() => _$MySubmissionDetailToJson(this);
}
