// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'my_submission.dart';

part 'my_submission_list.g.dart';

@JsonSerializable()
class MySubmissionList {
  const MySubmissionList({required this.items});

  factory MySubmissionList.fromJson(Map<String, Object?> json) =>
      _$MySubmissionListFromJson(json);

  final List<MySubmission> items;

  Map<String, Object?> toJson() => _$MySubmissionListToJson(this);
}
