// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'course.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Course _$CourseFromJson(Map<String, dynamic> json) => Course(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String,
  departmentId: (json['departmentId'] as num).toInt(),
);

Map<String, dynamic> _$CourseToJson(Course instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'departmentId': instance.departmentId,
};
