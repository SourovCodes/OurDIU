// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'submission_classification.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SubmissionClassification _$SubmissionClassificationFromJson(
  Map<String, dynamic> json,
) => SubmissionClassification(
  department: ClassifiedDepartment.fromJson(
    json['department'] as Map<String, dynamic>,
  ),
  course: ClassifiedValue.fromJson(json['course'] as Map<String, dynamic>),
  semester: ClassifiedValue.fromJson(json['semester'] as Map<String, dynamic>),
  examType: ExamType.fromJson(json['examType'] as Map<String, dynamic>),
);

Map<String, dynamic> _$SubmissionClassificationToJson(
  SubmissionClassification instance,
) => <String, dynamic>{
  'department': instance.department,
  'course': instance.course,
  'semester': instance.semester,
  'examType': instance.examType,
};
