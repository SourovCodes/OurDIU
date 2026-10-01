// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'course_list_item.dart';
import 'department_list_item.dart';
import 'exam_type.dart';
import 'semester.dart';

part 'taxonomy.g.dart';

@JsonSerializable()
class Taxonomy {
  const Taxonomy({
    required this.departments,
    required this.courses,
    required this.semesters,
    required this.examTypes,
  });

  factory Taxonomy.fromJson(Map<String, Object?> json) =>
      _$TaxonomyFromJson(json);

  final List<DepartmentListItem> departments;
  final List<CourseListItem> courses;
  final List<Semester> semesters;
  final List<ExamType> examTypes;

  Map<String, Object?> toJson() => _$TaxonomyToJson(this);
}
