// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'department_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DepartmentList _$DepartmentListFromJson(Map<String, dynamic> json) =>
    DepartmentList(
      items: (json['items'] as List<dynamic>)
          .map((e) => DepartmentListItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$DepartmentListToJson(DepartmentList instance) =>
    <String, dynamic>{'items': instance.items};
