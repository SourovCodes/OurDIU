// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'classified_department.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClassifiedDepartment _$ClassifiedDepartmentFromJson(
  Map<String, dynamic> json,
) => ClassifiedDepartment(
  id: (json['id'] as num?)?.toInt(),
  name: json['name'] as String,
  shortName: json['shortName'] as String?,
);

Map<String, dynamic> _$ClassifiedDepartmentToJson(
  ClassifiedDepartment instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'shortName': instance.shortName,
};
