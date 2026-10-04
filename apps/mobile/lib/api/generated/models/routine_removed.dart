// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'routine_removed.g.dart';

@JsonSerializable()
class RoutineRemoved {
  const RoutineRemoved({required this.removed});

  factory RoutineRemoved.fromJson(Map<String, Object?> json) =>
      _$RoutineRemovedFromJson(json);

  final int removed;

  Map<String, Object?> toJson() => _$RoutineRemovedToJson(this);
}
