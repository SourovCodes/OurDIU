// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'room_summary.g.dart';

@JsonSerializable()
class RoomSummary {
  const RoomSummary({
    required this.voice,
    required this.talking,
    required this.here,
  });

  factory RoomSummary.fromJson(Map<String, Object?> json) =>
      _$RoomSummaryFromJson(json);

  final int voice;
  final int talking;
  final int here;

  Map<String, Object?> toJson() => _$RoomSummaryToJson(this);
}
