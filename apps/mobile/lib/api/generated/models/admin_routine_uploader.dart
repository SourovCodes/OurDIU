// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'admin_routine_uploader.g.dart';

@JsonSerializable()
class AdminRoutineUploader {
  const AdminRoutineUploader({required this.name});

  factory AdminRoutineUploader.fromJson(Map<String, Object?> json) =>
      _$AdminRoutineUploaderFromJson(json);

  final String name;

  Map<String, Object?> toJson() => _$AdminRoutineUploaderToJson(this);
}
