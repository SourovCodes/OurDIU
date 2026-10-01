// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'contributor_submission.dart';

part 'contributor_submission_list.g.dart';

@JsonSerializable()
class ContributorSubmissionList {
  const ContributorSubmissionList({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  factory ContributorSubmissionList.fromJson(Map<String, Object?> json) =>
      _$ContributorSubmissionListFromJson(json);

  final List<ContributorSubmission> items;
  final int page;
  final int pageSize;
  final int total;

  Map<String, Object?> toJson() => _$ContributorSubmissionListToJson(this);
}
