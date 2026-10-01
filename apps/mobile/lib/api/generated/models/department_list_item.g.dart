// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'department_list_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DepartmentListItem _$DepartmentListItemFromJson(Map<String, dynamic> json) =>
    DepartmentListItem(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      shortName: json['shortName'] as String,
      publishedCount: (json['publishedCount'] as num).toInt(),
    );

Map<String, dynamic> _$DepartmentListItemToJson(DepartmentListItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'shortName': instance.shortName,
      'publishedCount': instance.publishedCount,
    };
