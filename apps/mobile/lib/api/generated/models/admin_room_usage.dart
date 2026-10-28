// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'admin_room_usage.g.dart';

@JsonSerializable()
class AdminRoomUsage {
  const AdminRoomUsage({
    required this.cycle,
    required this.resetsOn,
    required this.voiceBytes,
    required this.voiceSeconds,
    required this.messages,
    required this.voiceBytesCap,
    required this.messagesCap,
    required this.paused,
    required this.enabled,
    required this.voiceAvailable,
  });

  factory AdminRoomUsage.fromJson(Map<String, Object?> json) =>
      _$AdminRoomUsageFromJson(json);

  final DateTime cycle;
  final DateTime resetsOn;
  final int voiceBytes;
  final int voiceSeconds;
  final int messages;
  final int voiceBytesCap;
  final int messagesCap;
  final bool paused;
  final bool enabled;
  final bool voiceAvailable;

  Map<String, Object?> toJson() => _$AdminRoomUsageToJson(this);
}
