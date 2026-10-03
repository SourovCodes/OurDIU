// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_changes.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineChanges _$RoutineChangesFromJson(Map<String, dynamic> json) =>
    RoutineChanges(
      moved: (json['moved'] as num).toInt(),
      room: (json['room'] as num).toInt(),
      teacher: (json['teacher'] as num).toInt(),
      added: (json['added'] as num).toInt(),
      removed: (json['removed'] as num).toInt(),
      sectionsAdded: (json['sectionsAdded'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      sectionsRemoved: (json['sectionsRemoved'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      items: (json['items'] as List<dynamic>)
          .map((e) => RoutineChange.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$RoutineChangesToJson(RoutineChanges instance) =>
    <String, dynamic>{
      'moved': instance.moved,
      'room': instance.room,
      'teacher': instance.teacher,
      'added': instance.added,
      'removed': instance.removed,
      'sectionsAdded': instance.sectionsAdded,
      'sectionsRemoved': instance.sectionsRemoved,
      'items': instance.items,
    };
