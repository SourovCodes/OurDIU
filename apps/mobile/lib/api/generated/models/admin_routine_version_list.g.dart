// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_routine_version_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AdminRoutineVersionList _$AdminRoutineVersionListFromJson(
  Map<String, dynamic> json,
) => AdminRoutineVersionList(
  items: (json['items'] as List<dynamic>)
      .map((e) => AdminRoutineVersion.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$AdminRoutineVersionListToJson(
  AdminRoutineVersionList instance,
) => <String, dynamic>{'items': instance.items};
