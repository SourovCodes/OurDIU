// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'question.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Question _$QuestionFromJson(Map<String, dynamic> json) => Question(
  id: (json['id'] as num).toInt(),
  department: Department.fromJson(json['department'] as Map<String, dynamic>),
  course: QuestionCourse.fromJson(json['course'] as Map<String, dynamic>),
  semester: Semester.fromJson(json['semester'] as Map<String, dynamic>),
  examType: ExamType.fromJson(json['examType'] as Map<String, dynamic>),
  submissionCounts: SubmissionCounts.fromJson(
    json['submissionCounts'] as Map<String, dynamic>,
  ),
  viewCount: (json['viewCount'] as num).toInt(),
  viewsToday: (json['viewsToday'] as num?)?.toInt(),
);

Map<String, dynamic> _$QuestionToJson(Question instance) => <String, dynamic>{
  'id': instance.id,
  'department': instance.department,
  'course': instance.course,
  'semester': instance.semester,
  'examType': instance.examType,
  'submissionCounts': instance.submissionCounts,
  'viewCount': instance.viewCount,
  'viewsToday': instance.viewsToday,
};
