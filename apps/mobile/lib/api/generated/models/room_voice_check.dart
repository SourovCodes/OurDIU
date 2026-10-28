// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'room_voice_check.g.dart';

@JsonSerializable()
class RoomVoiceCheck {
  const RoomVoiceCheck({
    required this.ok,
    required this.status,
    required this.errorCode,
    required this.message,
  });

  factory RoomVoiceCheck.fromJson(Map<String, Object?> json) =>
      _$RoomVoiceCheckFromJson(json);

  final bool ok;
  final int status;
  final String? errorCode;
  final String message;

  Map<String, Object?> toJson() => _$RoomVoiceCheckToJson(this);
}
