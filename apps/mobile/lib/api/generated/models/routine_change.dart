// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_change_kind.dart';
import 'routine_changed_class.dart';

part 'routine_change.g.dart';

@JsonSerializable()
class RoutineChange {
  const RoutineChange({
    required this.section,
    required this.kind,
    required this.before,
    required this.after,
  });

  factory RoutineChange.fromJson(Map<String, Object?> json) =>
      _$RoutineChangeFromJson(json);

  final String section;
  final RoutineChangeKind kind;
  final RoutineChangedClass? before;
  final RoutineChangedClass? after;

  Map<String, Object?> toJson() => _$RoutineChangeToJson(this);
}
