// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_section_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineSectionList _$RoutineSectionListFromJson(Map<String, dynamic> json) =>
    RoutineSectionList(
      version: RoutineVersion.fromJson(json['version'] as Map<String, dynamic>),
      sections: (json['sections'] as List<dynamic>)
          .map((e) => RoutineSectionSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$RoutineSectionListToJson(RoutineSectionList instance) =>
    <String, dynamic>{
      'version': instance.version,
      'sections': instance.sections,
    };
