// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'admin_routine_version.dart';

part 'admin_routine_version_list.g.dart';

@JsonSerializable()
class AdminRoutineVersionList {
  const AdminRoutineVersionList({required this.items});

  factory AdminRoutineVersionList.fromJson(Map<String, Object?> json) =>
      _$AdminRoutineVersionListFromJson(json);

  final List<AdminRoutineVersion> items;

  Map<String, Object?> toJson() => _$AdminRoutineVersionListToJson(this);
}
