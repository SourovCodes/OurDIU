// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'cover_page_input.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CoverPageInput _$CoverPageInputFromJson(Map<String, dynamic> json) =>
    CoverPageInput(
      courseCode: json['courseCode'] as String?,
      courseTitle: json['courseTitle'] as String?,
      topic: json['topic'] as String?,
      experimentNo: json['experimentNo'] as String?,
      experimentName: json['experimentName'] as String?,
      teacherName: json['teacherName'] as String?,
      teacherDesignation: json['teacherDesignation'] as String?,
      teacherDepartment: json['teacherDepartment'] as String?,
      studentName: json['studentName'] as String?,
      studentId: json['studentId'] as String?,
      section: json['section'] as String?,
      semester: json['semester'] as String?,
      studentDepartment: json['studentDepartment'] as String?,
      date: json['date'] as String?,
      degree: json['degree'] as String?,
      monthYear: json['monthYear'] as String?,
      members: (json['members'] as List<dynamic>?)
          ?.map((e) => CoverPageMember.fromJson(e as Map<String, dynamic>))
          .toList(),
      experiments: (json['experiments'] as List<dynamic>?)
          ?.map((e) => CoverPageExperiment.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$CoverPageInputToJson(CoverPageInput instance) =>
    <String, dynamic>{
      'courseCode': instance.courseCode,
      'courseTitle': instance.courseTitle,
      'topic': instance.topic,
      'experimentNo': instance.experimentNo,
      'experimentName': instance.experimentName,
      'teacherName': instance.teacherName,
      'teacherDesignation': instance.teacherDesignation,
      'teacherDepartment': instance.teacherDepartment,
      'studentName': instance.studentName,
      'studentId': instance.studentId,
      'section': instance.section,
      'semester': instance.semester,
      'studentDepartment': instance.studentDepartment,
      'date': instance.date,
      'degree': instance.degree,
      'monthYear': instance.monthYear,
      'members': instance.members,
      'experiments': instance.experiments,
    };
