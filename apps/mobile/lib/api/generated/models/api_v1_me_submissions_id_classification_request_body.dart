// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'api_v1_me_submissions_id_classification_request_body.g.dart';

@JsonSerializable()
class ApiV1MeSubmissionsIdClassificationRequestBody {
  const ApiV1MeSubmissionsIdClassificationRequestBody({
    required this.examTypeId,
    this.departmentId,
    this.customDepartmentName,
    this.customDepartmentShortName,
    this.courseId,
    this.customCourseName,
    this.semesterId,
    this.customSemesterName,
    this.section,
    this.batch,
  });

  factory ApiV1MeSubmissionsIdClassificationRequestBody.fromJson(
    Map<String, Object?> json,
  ) => _$ApiV1MeSubmissionsIdClassificationRequestBodyFromJson(json);

  final int? departmentId;
  final String? customDepartmentName;
  final String? customDepartmentShortName;
  final int? courseId;
  final String? customCourseName;
  final int? semesterId;
  final String? customSemesterName;
  final int examTypeId;
  final String? section;
  final String? batch;

  Map<String, Object?> toJson() =>
      _$ApiV1MeSubmissionsIdClassificationRequestBodyToJson(this);
}
