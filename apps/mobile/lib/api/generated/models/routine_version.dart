// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_department.dart';

part 'routine_version.g.dart';

@JsonSerializable()
class RoutineVersion {
  const RoutineVersion({
    required this.department,
    required this.version,
    required this.publishedOn,
    required this.source,
    required this.liveSince,
  });

  factory RoutineVersion.fromJson(Map<String, Object?> json) =>
      _$RoutineVersionFromJson(json);

  final RoutineDepartment department;
  final String version;
  final DateTime? publishedOn;
  final String? source;
  final DateTime liveSince;

  Map<String, Object?> toJson() => _$RoutineVersionToJson(this);
}
