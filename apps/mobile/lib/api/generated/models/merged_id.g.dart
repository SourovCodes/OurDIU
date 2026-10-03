// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'merged_id.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MergedId _$MergedIdFromJson(Map<String, dynamic> json) => MergedId(
  kind: MergedKind.fromJson(json['kind'] as String),
  id: (json['id'] as num).toInt(),
  mergedInto: (json['mergedInto'] as num).toInt(),
);

Map<String, dynamic> _$MergedIdToJson(MergedId instance) => <String, dynamic>{
  'kind': _$MergedKindEnumMap[instance.kind]!,
  'id': instance.id,
  'mergedInto': instance.mergedInto,
};

const _$MergedKindEnumMap = {
  MergedKind.question: 'question',
  MergedKind.department: 'department',
  MergedKind.course: 'course',
  MergedKind.semester: 'semester',
  MergedKind.examType: 'exam_type',
  MergedKind.$unknown: r'$unknown',
};
