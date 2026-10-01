// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'contributor_department.dart';
import 'contributor_submission_list.dart';

part 'contributor_detail.g.dart';

@JsonSerializable()
class ContributorDetail {
  const ContributorDetail({
    required this.id,
    required this.username,
    required this.name,
    required this.image,
    required this.joinedAt,
    required this.publishedCount,
    required this.viewCount,
    required this.departments,
    required this.submissions,
  });

  factory ContributorDetail.fromJson(Map<String, Object?> json) =>
      _$ContributorDetailFromJson(json);

  final String id;
  final String username;
  final String name;
  final String? image;
  final DateTime joinedAt;
  final int publishedCount;
  final int viewCount;
  final List<ContributorDepartment> departments;
  final ContributorSubmissionList submissions;

  Map<String, Object?> toJson() => _$ContributorDetailToJson(this);
}
