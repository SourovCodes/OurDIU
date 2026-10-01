// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'contributor_department.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ContributorDepartment _$ContributorDepartmentFromJson(
  Map<String, dynamic> json,
) => ContributorDepartment(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String,
  shortName: json['shortName'] as String,
  publishedCount: (json['publishedCount'] as num).toInt(),
);

Map<String, dynamic> _$ContributorDepartmentToJson(
  ContributorDepartment instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'shortName': instance.shortName,
  'publishedCount': instance.publishedCount,
};
