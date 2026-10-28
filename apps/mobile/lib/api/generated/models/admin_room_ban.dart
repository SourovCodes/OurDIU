// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'admin_room_user.dart';

part 'admin_room_ban.g.dart';

@JsonSerializable()
class AdminRoomBan {
  const AdminRoomBan({required this.user, required this.createdAt});

  factory AdminRoomBan.fromJson(Map<String, Object?> json) =>
      _$AdminRoomBanFromJson(json);

  final AdminRoomUser user;
  final DateTime createdAt;

  Map<String, Object?> toJson() => _$AdminRoomBanToJson(this);
}
