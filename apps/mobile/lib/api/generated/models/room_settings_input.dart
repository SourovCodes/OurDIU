// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'room_settings_input.g.dart';

@JsonSerializable()
class RoomSettingsInput {
  const RoomSettingsInput({required this.paused});

  factory RoomSettingsInput.fromJson(Map<String, Object?> json) =>
      _$RoomSettingsInputFromJson(json);

  final bool paused;

  Map<String, Object?> toJson() => _$RoomSettingsInputToJson(this);
}
