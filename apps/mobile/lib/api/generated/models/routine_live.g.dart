// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'routine_live.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoutineLive _$RoutineLiveFromJson(Map<String, dynamic> json) => RoutineLive(
  versions: (json['versions'] as List<dynamic>)
      .map((e) => RoutineVersion.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$RoutineLiveToJson(RoutineLive instance) =>
    <String, dynamic>{'versions': instance.versions};
