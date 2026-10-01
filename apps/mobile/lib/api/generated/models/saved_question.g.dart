// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'saved_question.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SavedQuestion _$SavedQuestionFromJson(Map<String, dynamic> json) =>
    SavedQuestion(
      id: (json['id'] as num).toInt(),
      department: Department.fromJson(
        json['department'] as Map<String, dynamic>,
      ),
      course: QuestionCourse.fromJson(json['course'] as Map<String, dynamic>),
      semester: Semester.fromJson(json['semester'] as Map<String, dynamic>),
      examType: ExamType.fromJson(json['examType'] as Map<String, dynamic>),
      submissionCounts: SubmissionCounts.fromJson(
        json['submissionCounts'] as Map<String, dynamic>,
      ),
      viewCount: (json['viewCount'] as num).toInt(),
      savedAt: DateTime.parse(json['savedAt'] as String),
    );

Map<String, dynamic> _$SavedQuestionToJson(SavedQuestion instance) =>
    <String, dynamic>{
      'id': instance.id,
      'department': instance.department,
      'course': instance.course,
      'semester': instance.semester,
      'examType': instance.examType,
      'submissionCounts': instance.submissionCounts,
      'viewCount': instance.viewCount,
      'savedAt': instance.savedAt.toIso8601String(),
    };
