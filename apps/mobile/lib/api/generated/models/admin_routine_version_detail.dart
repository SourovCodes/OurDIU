// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'admin_routine_uploader.dart';
import 'routine_changes.dart';
import 'routine_department.dart';
import 'routine_version_status.dart';
import 'routine_warning.dart';

part 'admin_routine_version_detail.g.dart';

@JsonSerializable()
class AdminRoutineVersionDetail {
  const AdminRoutineVersionDetail({
    required this.id,
    required this.department,
    required this.version,
    required this.publishedOn,
    required this.source,
    required this.hasPdf,
    required this.status,
    required this.sectionCount,
    required this.classCount,
    required this.warningCount,
    required this.uploadedBy,
    required this.createdAt,
    required this.liveAt,
    required this.replacedAt,
    required this.sections,
    required this.warnings,
    required this.comparedWith,
    required this.changes,
  });

  factory AdminRoutineVersionDetail.fromJson(Map<String, Object?> json) =>
      _$AdminRoutineVersionDetailFromJson(json);

  final int id;
  final RoutineDepartment department;
  final String version;
  final DateTime? publishedOn;
  final String? source;
  final bool hasPdf;
  final RoutineVersionStatus status;
  final int sectionCount;
  final int classCount;
  final int warningCount;
  final AdminRoutineUploader? uploadedBy;
  final DateTime createdAt;
  final DateTime? liveAt;
  final DateTime? replacedAt;
  final List<String> sections;
  final List<RoutineWarning> warnings;
  final String? comparedWith;
  final RoutineChanges changes;

  Map<String, Object?> toJson() => _$AdminRoutineVersionDetailToJson(this);
}
