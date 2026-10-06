// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'cover_page_member.dart';

part 'cover_page_input.g.dart';

@JsonSerializable()
class CoverPageInput {
  const CoverPageInput({
    this.courseCode,
    this.courseTitle,
    this.topic,
    this.experimentNo,
    this.experimentName,
    this.teacherName,
    this.teacherDesignation,
    this.teacherDepartment,
    this.studentName,
    this.studentId,
    this.section,
    this.semester,
    this.studentDepartment,
    this.date,
    this.members,
  });

  factory CoverPageInput.fromJson(Map<String, Object?> json) =>
      _$CoverPageInputFromJson(json);

  final String? courseCode;
  final String? courseTitle;
  final String? topic;
  final String? experimentNo;
  final String? experimentName;
  final String? teacherName;
  final String? teacherDesignation;
  final String? teacherDepartment;
  final String? studentName;
  final String? studentId;
  final String? section;
  final String? semester;
  final String? studentDepartment;
  final String? date;
  final List<CoverPageMember>? members;

  Map<String, Object?> toJson() => _$CoverPageInputToJson(this);
}
