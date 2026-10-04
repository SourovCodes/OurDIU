// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'routine_version_catalog.g.dart';

@JsonSerializable()
class RoutineVersionCatalog {
  const RoutineVersionCatalog({
    required this.courses,
    required this.titled,
    required this.teachers,
    required this.named,
  });

  factory RoutineVersionCatalog.fromJson(Map<String, Object?> json) =>
      _$RoutineVersionCatalogFromJson(json);

  final int courses;
  final int titled;
  final int teachers;
  final int named;

  Map<String, Object?> toJson() => _$RoutineVersionCatalogToJson(this);
}
