// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'taxonomy.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Taxonomy _$TaxonomyFromJson(Map<String, dynamic> json) => Taxonomy(
  departments: (json['departments'] as List<dynamic>)
      .map((e) => DepartmentListItem.fromJson(e as Map<String, dynamic>))
      .toList(),
  courses: (json['courses'] as List<dynamic>)
      .map((e) => CourseListItem.fromJson(e as Map<String, dynamic>))
      .toList(),
  semesters: (json['semesters'] as List<dynamic>)
      .map((e) => Semester.fromJson(e as Map<String, dynamic>))
      .toList(),
  examTypes: (json['examTypes'] as List<dynamic>)
      .map((e) => ExamType.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$TaxonomyToJson(Taxonomy instance) => <String, dynamic>{
  'departments': instance.departments,
  'courses': instance.courses,
  'semesters': instance.semesters,
  'examTypes': instance.examTypes,
};
