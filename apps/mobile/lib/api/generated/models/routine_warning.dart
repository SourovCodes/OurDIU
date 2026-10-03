// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_warning_kind.dart';

part 'routine_warning.g.dart';

@JsonSerializable()
class RoutineWarning {
  const RoutineWarning({required this.kind, required this.message});

  factory RoutineWarning.fromJson(Map<String, Object?> json) =>
      _$RoutineWarningFromJson(json);

  final RoutineWarningKind kind;
  final String message;

  Map<String, Object?> toJson() => _$RoutineWarningToJson(this);
}
