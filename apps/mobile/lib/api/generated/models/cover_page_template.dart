// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

@JsonEnum()
enum CoverPageTemplate {
  @JsonValue('assignment')
  assignment('assignment'),
  @JsonValue('lab-report')
  labReport('lab-report'),
  @JsonValue('group-assignment')
  groupAssignment('group-assignment'),
  @JsonValue('final-lab-report')
  finalLabReport('final-lab-report'),
  @JsonValue('presentation')
  presentation('presentation'),
  @JsonValue('project-report')
  projectReport('project-report'),
  @JsonValue('lab-report-index')
  labReportIndex('lab-report-index'),
  @JsonValue('internship-report')
  internshipReport('internship-report'),
  @JsonValue('final-year-project')
  finalYearProject('final-year-project'),

  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const CoverPageTemplate(this.json);

  factory CoverPageTemplate.fromJson(String json) =>
      values.firstWhere((e) => e.json == json, orElse: () => $unknown);

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();

  /// Returns all defined enum values excluding the $unknown value.
  static List<CoverPageTemplate> get $valuesDefined =>
      values.where((value) => value != $unknown).toList();
}
