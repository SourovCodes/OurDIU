// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'routine_change.dart';

part 'routine_changes.g.dart';

@JsonSerializable()
class RoutineChanges {
  const RoutineChanges({
    required this.moved,
    required this.room,
    required this.teacher,
    required this.added,
    required this.removed,
    required this.sectionsAdded,
    required this.sectionsRemoved,
    required this.items,
  });

  factory RoutineChanges.fromJson(Map<String, Object?> json) =>
      _$RoutineChangesFromJson(json);

  final int moved;
  final int room;
  final int teacher;
  final int added;
  final int removed;
  final List<String> sectionsAdded;
  final List<String> sectionsRemoved;
  final List<RoutineChange> items;

  Map<String, Object?> toJson() => _$RoutineChangesToJson(this);
}
