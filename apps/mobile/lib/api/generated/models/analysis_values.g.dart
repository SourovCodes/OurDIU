// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'analysis_values.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AnalysisValues _$AnalysisValuesFromJson(Map<String, dynamic> json) =>
    AnalysisValues(
      department: json['department'] == null
          ? null
          : ExtractedDepartment.fromJson(
              json['department'] as Map<String, dynamic>,
            ),
      course: json['course'] == null
          ? null
          : ExtractedValue.fromJson(json['course'] as Map<String, dynamic>),
      semester: json['semester'] == null
          ? null
          : ExtractedValue.fromJson(json['semester'] as Map<String, dynamic>),
      examType: json['examType'] == null
          ? null
          : ExtractedValue.fromJson(json['examType'] as Map<String, dynamic>),
      section: json['section'] as String?,
      batch: json['batch'] as String?,
    );

Map<String, dynamic> _$AnalysisValuesToJson(AnalysisValues instance) =>
    <String, dynamic>{
      'department': instance.department,
      'course': instance.course,
      'semester': instance.semester,
      'examType': instance.examType,
      'section': instance.section,
      'batch': instance.batch,
    };
