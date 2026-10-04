// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'admin_routine_uploader.dart';
import 'routine_department.dart';
import 'routine_version_status.dart';

part 'admin_routine_version.g.dart';

@JsonSerializable()
class AdminRoutineVersion {
  const AdminRoutineVersion({
    required this.id,
    required this.department,
    required this.version,
    required this.publishedOn,
    required this.source,
    required this.status,
    required this.sectionCount,
    required this.classCount,
    required this.warningCount,
    required this.uploadedBy,
    required this.createdAt,
    required this.liveAt,
    required this.replacedAt,
  });

  factory AdminRoutineVersion.fromJson(Map<String, Object?> json) =>
      _$AdminRoutineVersionFromJson(json);

  final int id;
  final RoutineDepartment department;
  final String version;
  final DateTime? publishedOn;
  final String? source;
  final RoutineVersionStatus status;
  final int sectionCount;
  final int classCount;
  final int warningCount;
  final AdminRoutineUploader? uploadedBy;
  final DateTime createdAt;
  final DateTime? liveAt;
  final DateTime? replacedAt;

  Map<String, Object?> toJson() => _$AdminRoutineVersionToJson(this);
}
