// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'api_v1_me_submissions_id_classification_request_body.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ApiV1MeSubmissionsIdClassificationRequestBody
_$ApiV1MeSubmissionsIdClassificationRequestBodyFromJson(
  Map<String, dynamic> json,
) => ApiV1MeSubmissionsIdClassificationRequestBody(
  examTypeId: (json['examTypeId'] as num).toInt(),
  departmentId: (json['departmentId'] as num?)?.toInt(),
  customDepartmentName: json['customDepartmentName'] as String?,
  customDepartmentShortName: json['customDepartmentShortName'] as String?,
  courseId: (json['courseId'] as num?)?.toInt(),
  customCourseName: json['customCourseName'] as String?,
  semesterId: (json['semesterId'] as num?)?.toInt(),
  customSemesterName: json['customSemesterName'] as String?,
  section: json['section'] as String?,
  batch: json['batch'] as String?,
);

Map<String, dynamic> _$ApiV1MeSubmissionsIdClassificationRequestBodyToJson(
  ApiV1MeSubmissionsIdClassificationRequestBody instance,
) => <String, dynamic>{
  'departmentId': instance.departmentId,
  'customDepartmentName': instance.customDepartmentName,
  'customDepartmentShortName': instance.customDepartmentShortName,
  'courseId': instance.courseId,
  'customCourseName': instance.customCourseName,
  'semesterId': instance.semesterId,
  'customSemesterName': instance.customSemesterName,
  'examTypeId': instance.examTypeId,
  'section': instance.section,
  'batch': instance.batch,
};
