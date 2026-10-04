// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_version_catalog.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineVersionCatalog _$RoutineVersionCatalogFromJson(
  Map<String, dynamic> json,
) => RoutineVersionCatalog(
  courses: (json['courses'] as num).toInt(),
  titled: (json['titled'] as num).toInt(),
  teachers: (json['teachers'] as num).toInt(),
  named: (json['named'] as num).toInt(),
);

Map<String, dynamic> _$RoutineVersionCatalogToJson(
  RoutineVersionCatalog instance,
) => <String, dynamic>{
  'courses': instance.courses,
  'titled': instance.titled,
  'teachers': instance.teachers,
  'named': instance.named,
};
