// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'extracted_department.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ExtractedDepartment _$ExtractedDepartmentFromJson(Map<String, dynamic> json) =>
    ExtractedDepartment(
      id: (json['id'] as num?)?.toInt(),
      name: json['name'] as String,
      shortName: json['shortName'] as String?,
    );

Map<String, dynamic> _$ExtractedDepartmentToJson(
  ExtractedDepartment instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'shortName': instance.shortName,
};
