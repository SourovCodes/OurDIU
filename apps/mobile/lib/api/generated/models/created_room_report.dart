// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'created_room_report.g.dart';

@JsonSerializable()
class CreatedRoomReport {
  const CreatedRoomReport({required this.id});

  factory CreatedRoomReport.fromJson(Map<String, Object?> json) =>
      _$CreatedRoomReportFromJson(json);

  final int id;

  Map<String, Object?> toJson() => _$CreatedRoomReportToJson(this);
}
