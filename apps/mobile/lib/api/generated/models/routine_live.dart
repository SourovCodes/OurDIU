// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_version.dart';

part 'routine_live.g.dart';

@JsonSerializable()
class RoutineLive {
  const RoutineLive({required this.versions});

  factory RoutineLive.fromJson(Map<String, Object?> json) =>
      _$RoutineLiveFromJson(json);

  final List<RoutineVersion> versions;

  Map<String, Object?> toJson() => _$RoutineLiveToJson(this);
}
