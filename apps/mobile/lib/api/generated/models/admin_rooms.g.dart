// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_rooms.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AdminRooms _$AdminRoomsFromJson(Map<String, dynamic> json) => AdminRooms(
  usage: AdminRoomUsage.fromJson(json['usage'] as Map<String, dynamic>),
  reports: (json['reports'] as List<dynamic>)
      .map((e) => AdminRoomReport.fromJson(e as Map<String, dynamic>))
      .toList(),
  bans: (json['bans'] as List<dynamic>)
      .map((e) => AdminRoomBan.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$AdminRoomsToJson(AdminRooms instance) =>
    <String, dynamic>{
      'usage': instance.usage,
      'reports': instance.reports,
      'bans': instance.bans,
    };
