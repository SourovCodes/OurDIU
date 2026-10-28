// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'update_room_report_input_status.dart';

part 'update_room_report_input.g.dart';

@JsonSerializable()
class UpdateRoomReportInput {
  const UpdateRoomReportInput({required this.status});

  factory UpdateRoomReportInput.fromJson(Map<String, Object?> json) =>
      _$UpdateRoomReportInputFromJson(json);

  final UpdateRoomReportInputStatus status;

  Map<String, Object?> toJson() => _$UpdateRoomReportInputToJson(this);
}
