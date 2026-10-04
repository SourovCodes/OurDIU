// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_routine_version_detail.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AdminRoutineVersionDetail _$AdminRoutineVersionDetailFromJson(
  Map<String, dynamic> json,
) => AdminRoutineVersionDetail(
  id: (json['id'] as num).toInt(),
  department: RoutineDepartment.fromJson(json['department'] as String),
  version: json['version'] as String,
  publishedOn: json['publishedOn'] == null
      ? null
      : DateTime.parse(json['publishedOn'] as String),
  source: json['source'] as String?,
  status: RoutineVersionStatus.fromJson(json['status'] as String),
  sectionCount: (json['sectionCount'] as num).toInt(),
  classCount: (json['classCount'] as num).toInt(),
  warningCount: (json['warningCount'] as num).toInt(),
  uploadedBy: json['uploadedBy'] == null
      ? null
      : AdminRoutineUploader.fromJson(
          json['uploadedBy'] as Map<String, dynamic>,
        ),
  createdAt: DateTime.parse(json['createdAt'] as String),
  liveAt: json['liveAt'] == null
      ? null
      : DateTime.parse(json['liveAt'] as String),
  replacedAt: json['replacedAt'] == null
      ? null
      : DateTime.parse(json['replacedAt'] as String),
  sections: (json['sections'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
  warnings: (json['warnings'] as List<dynamic>)
      .map((e) => RoutineWarning.fromJson(e as Map<String, dynamic>))
      .toList(),
  comparedWith: json['comparedWith'] as String?,
  changes: RoutineChanges.fromJson(json['changes'] as Map<String, dynamic>),
);

Map<String, dynamic> _$AdminRoutineVersionDetailToJson(
  AdminRoutineVersionDetail instance,
) => <String, dynamic>{
  'id': instance.id,
  'department': _$RoutineDepartmentEnumMap[instance.department]!,
  'version': instance.version,
  'publishedOn': instance.publishedOn?.toIso8601String(),
  'source': instance.source,
  'status': _$RoutineVersionStatusEnumMap[instance.status]!,
  'sectionCount': instance.sectionCount,
  'classCount': instance.classCount,
  'warningCount': instance.warningCount,
  'uploadedBy': instance.uploadedBy,
  'createdAt': instance.createdAt.toIso8601String(),
  'liveAt': instance.liveAt?.toIso8601String(),
  'replacedAt': instance.replacedAt?.toIso8601String(),
  'sections': instance.sections,
  'warnings': instance.warnings,
  'comparedWith': instance.comparedWith,
  'changes': instance.changes,
};

const _$RoutineDepartmentEnumMap = {
  RoutineDepartment.cse: 'CSE',
  RoutineDepartment.eee: 'EEE',
  RoutineDepartment.$unknown: r'$unknown',
};

const _$RoutineVersionStatusEnumMap = {
  RoutineVersionStatus.draft: 'draft',
  RoutineVersionStatus.live: 'live',
  RoutineVersionStatus.previous: 'previous',
  RoutineVersionStatus.$unknown: r'$unknown',
};
