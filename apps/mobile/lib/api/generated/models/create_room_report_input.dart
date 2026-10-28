// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'room_report_reason.dart';

part 'create_room_report_input.g.dart';

@JsonSerializable()
class CreateRoomReportInput {
  const CreateRoomReportInput({
    required this.userId,
    required this.reason,
    this.message,
  });

  factory CreateRoomReportInput.fromJson(Map<String, Object?> json) =>
      _$CreateRoomReportInputFromJson(json);

  final String userId;
  final RoomReportReason reason;
  final String? message;

  Map<String, Object?> toJson() => _$CreateRoomReportInputToJson(this);
}
