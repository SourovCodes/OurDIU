// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'admin_room_user.g.dart';

@JsonSerializable()
class AdminRoomUser {
  const AdminRoomUser({
    required this.id,
    required this.username,
    required this.name,
    required this.email,
    required this.image,
  });

  factory AdminRoomUser.fromJson(Map<String, Object?> json) =>
      _$AdminRoomUserFromJson(json);

  final String id;
  final String username;
  final String name;
  final String email;
  final String? image;

  Map<String, Object?> toJson() => _$AdminRoomUserToJson(this);
}
