// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'admin_room_ban.dart';
import 'admin_room_report.dart';
import 'admin_room_usage.dart';

part 'admin_rooms.g.dart';

@JsonSerializable()
class AdminRooms {
  const AdminRooms({
    required this.usage,
    required this.reports,
    required this.bans,
  });

  factory AdminRooms.fromJson(Map<String, Object?> json) =>
      _$AdminRoomsFromJson(json);

  final AdminRoomUsage usage;
  final List<AdminRoomReport> reports;
  final List<AdminRoomBan> bans;

  Map<String, Object?> toJson() => _$AdminRoomsToJson(this);
}
