// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_room_ban.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AdminRoomBan _$AdminRoomBanFromJson(Map<String, dynamic> json) => AdminRoomBan(
  user: AdminRoomUser.fromJson(json['user'] as Map<String, dynamic>),
  createdAt: DateTime.parse(json['createdAt'] as String),
);

Map<String, dynamic> _$AdminRoomBanToJson(AdminRoomBan instance) =>
    <String, dynamic>{
      'user': instance.user,
      'createdAt': instance.createdAt.toIso8601String(),
    };
