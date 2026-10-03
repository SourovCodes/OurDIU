// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_file.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineFile _$RoutineFileFromJson(Map<String, dynamic> json) => RoutineFile(
  format: RoutineFileFormat.fromJson(json['format'] as num),
  department: RoutineDepartment.fromJson(json['department'] as String),
  version: json['version'] as String,
  slots: (json['slots'] as List<dynamic>)
      .map((e) => RoutineSlot.fromJson(e as Map<String, dynamic>))
      .toList(),
  classes: (json['classes'] as List<dynamic>)
      .map((e) => RoutineFileClass.fromJson(e as Map<String, dynamic>))
      .toList(),
  publishedOn: json['publishedOn'] == null
      ? null
      : DateTime.parse(json['publishedOn'] as String),
  source: json['source'] as String?,
  courses: (json['courses'] as Map<String, dynamic>?)?.map(
    (k, e) => MapEntry(k, e as String),
  ),
  teachers: (json['teachers'] as Map<String, dynamic>?)?.map(
    (k, e) => MapEntry(k, e as String),
  ),
);

Map<String, dynamic> _$RoutineFileToJson(RoutineFile instance) =>
    <String, dynamic>{
      'format': _$RoutineFileFormatEnumMap[instance.format]!,
      'department': _$RoutineDepartmentEnumMap[instance.department]!,
      'version': instance.version,
      'publishedOn': instance.publishedOn?.toIso8601String(),
      'source': instance.source,
      'slots': instance.slots,
      'courses': instance.courses,
      'teachers': instance.teachers,
      'classes': instance.classes,
    };

const _$RoutineFileFormatEnumMap = {
  RoutineFileFormat.value1: 1,
  RoutineFileFormat.$unknown: r'$unknown',
};

const _$RoutineDepartmentEnumMap = {
  RoutineDepartment.cse: 'CSE',
  RoutineDepartment.$unknown: r'$unknown',
};
