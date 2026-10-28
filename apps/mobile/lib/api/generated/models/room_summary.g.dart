// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'room_summary.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoomSummary _$RoomSummaryFromJson(Map<String, dynamic> json) => RoomSummary(
  voice: (json['voice'] as num).toInt(),
  talking: (json['talking'] as num).toInt(),
  here: (json['here'] as num).toInt(),
);

Map<String, dynamic> _$RoomSummaryToJson(RoomSummary instance) =>
    <String, dynamic>{
      'voice': instance.voice,
      'talking': instance.talking,
      'here': instance.here,
    };
