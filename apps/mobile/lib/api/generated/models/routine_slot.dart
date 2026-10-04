// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'routine_slot.g.dart';

@JsonSerializable()
class RoutineSlot {
  const RoutineSlot({required this.start, required this.end});

  factory RoutineSlot.fromJson(Map<String, Object?> json) =>
      _$RoutineSlotFromJson(json);

  final String start;
  final String end;

  Map<String, Object?> toJson() => _$RoutineSlotToJson(this);
}
