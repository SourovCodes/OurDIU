// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_room_user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AdminRoomUser _$AdminRoomUserFromJson(Map<String, dynamic> json) =>
    AdminRoomUser(
      id: json['id'] as String,
      username: json['username'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      image: json['image'] as String?,
    );

Map<String, dynamic> _$AdminRoomUserToJson(AdminRoomUser instance) =>
    <String, dynamic>{
      'id': instance.id,
      'username': instance.username,
      'name': instance.name,
      'email': instance.email,
      'image': instance.image,
    };
