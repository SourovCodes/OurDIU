// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_version.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineVersion _$RoutineVersionFromJson(Map<String, dynamic> json) =>
    RoutineVersion(
      department: RoutineDepartment.fromJson(json['department'] as String),
      version: json['version'] as String,
      publishedOn: json['publishedOn'] == null
          ? null
          : DateTime.parse(json['publishedOn'] as String),
      source: json['source'] as String?,
      liveSince: DateTime.parse(json['liveSince'] as String),
    );

Map<String, dynamic> _$RoutineVersionToJson(RoutineVersion instance) =>
    <String, dynamic>{
      'department': _$RoutineDepartmentEnumMap[instance.department]!,
      'version': instance.version,
      'publishedOn': instance.publishedOn?.toIso8601String(),
      'source': instance.source,
      'liveSince': instance.liveSince.toIso8601String(),
    };

const _$RoutineDepartmentEnumMap = {
  RoutineDepartment.cse: 'CSE',
  RoutineDepartment.eee: 'EEE',
  RoutineDepartment.swe: 'SWE',
  RoutineDepartment.$unknown: r'$unknown',
};
