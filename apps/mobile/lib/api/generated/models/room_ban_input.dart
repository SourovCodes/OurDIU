// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'room_ban_input.g.dart';

@JsonSerializable()
class RoomBanInput {
  const RoomBanInput({this.reportId});

  factory RoomBanInput.fromJson(Map<String, Object?> json) =>
      _$RoomBanInputFromJson(json);

  final int? reportId;

  Map<String, Object?> toJson() => _$RoomBanInputToJson(this);
}
