// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'routine_version_input.g.dart';

@JsonSerializable()
class RoutineVersionInput {
  const RoutineVersionInput({required this.version});

  factory RoutineVersionInput.fromJson(Map<String, Object?> json) =>
      _$RoutineVersionInputFromJson(json);

  final String version;

  Map<String, Object?> toJson() => _$RoutineVersionInputToJson(this);
}
