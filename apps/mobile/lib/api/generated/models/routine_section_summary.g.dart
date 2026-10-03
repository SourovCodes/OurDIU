// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_section_summary.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineSectionSummary _$RoutineSectionSummaryFromJson(
  Map<String, dynamic> json,
) => RoutineSectionSummary(
  section: json['section'] as String,
  labGroups: (json['labGroups'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
  classCount: (json['classCount'] as num).toInt(),
);

Map<String, dynamic> _$RoutineSectionSummaryToJson(
  RoutineSectionSummary instance,
) => <String, dynamic>{
  'section': instance.section,
  'labGroups': instance.labGroups,
  'classCount': instance.classCount,
};
