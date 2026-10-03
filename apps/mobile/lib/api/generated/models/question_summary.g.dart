// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'question_summary.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

QuestionSummary _$QuestionSummaryFromJson(Map<String, dynamic> json) =>
    QuestionSummary(
      id: (json['id'] as num).toInt(),
      department: Department.fromJson(
        json['department'] as Map<String, dynamic>,
      ),
      course: QuestionCourse.fromJson(json['course'] as Map<String, dynamic>),
      semester: Semester.fromJson(json['semester'] as Map<String, dynamic>),
      examType: ExamType.fromJson(json['examType'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$QuestionSummaryToJson(QuestionSummary instance) =>
    <String, dynamic>{
      'id': instance.id,
      'department': instance.department,
      'course': instance.course,
      'semester': instance.semester,
      'examType': instance.examType,
    };
