// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'submission_status.dart';

part 'created_submission.g.dart';

@JsonSerializable()
class CreatedSubmission {
  const CreatedSubmission({
    required this.id,
    required this.status,
    required this.questionId,
  });

  factory CreatedSubmission.fromJson(Map<String, Object?> json) =>
      _$CreatedSubmissionFromJson(json);

  final int id;
  final SubmissionStatus status;
  final int? questionId;

  Map<String, Object?> toJson() => _$CreatedSubmissionToJson(this);
}
