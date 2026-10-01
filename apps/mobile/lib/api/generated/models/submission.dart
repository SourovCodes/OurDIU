// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'submission_status.dart';
import 'uploader.dart';

part 'submission.g.dart';

@JsonSerializable()
class Submission {
  const Submission({
    required this.likeCount,
    required this.dislikeCount,
    required this.viewCount,
    required this.id,
    required this.status,
    required this.fileSize,
    required this.createdAt,
    required this.section,
    required this.batch,
    required this.uploader,
    required this.fileUrl,
  });

  factory Submission.fromJson(Map<String, Object?> json) =>
      _$SubmissionFromJson(json);

  final int likeCount;
  final int dislikeCount;
  final int viewCount;
  final int id;
  final SubmissionStatus status;
  final int fileSize;
  final DateTime createdAt;
  final String? section;
  final String? batch;
  final Uploader? uploader;
  final String? fileUrl;

  Map<String, Object?> toJson() => _$SubmissionToJson(this);
}
