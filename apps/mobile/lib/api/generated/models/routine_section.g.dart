// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_section.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineSection _$RoutineSectionFromJson(Map<String, dynamic> json) =>
    RoutineSection(
      version: RoutineVersion.fromJson(json['version'] as Map<String, dynamic>),
      section: json['section'] as String,
      labGroups: (json['labGroups'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      slots: (json['slots'] as List<dynamic>)
          .map((e) => RoutineSlot.fromJson(e as Map<String, dynamic>))
          .toList(),
      classes: (json['classes'] as List<dynamic>)
          .map((e) => RoutineClass.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$RoutineSectionToJson(RoutineSection instance) =>
    <String, dynamic>{
      'version': instance.version,
      'section': instance.section,
      'labGroups': instance.labGroups,
      'slots': instance.slots,
      'classes': instance.classes,
    };
